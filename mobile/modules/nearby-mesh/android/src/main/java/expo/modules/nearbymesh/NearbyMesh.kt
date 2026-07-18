package expo.modules.nearbymesh

import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets
import java.util.Collections

class NearbyMesh : Module() {
  private val strategy = Strategy.P2P_CLUSTER
  private val connected = Collections.synchronizedSet(mutableSetOf<String>())
  private val pending = Collections.synchronizedSet(mutableSetOf<String>())
  private lateinit var client: ConnectionsClient
  private var serviceId = ""
  private var operationTag = ""
  private var endpointName = ""

  override fun definition() = ModuleDefinition {
    Events("onStatus", "onMessage")
    AsyncFunction("start") { options: Map<String, String> ->
      serviceId = options["serviceId"]?.take(150) ?: throw IllegalArgumentException("serviceId ausente")
      operationTag = options["operationId"]?.take(36) ?: throw IllegalArgumentException("operationId ausente")
      endpointName = "${operationTag.take(8)}|${options["endpointName"]?.take(80) ?: "Mais Trilha"}"
      client = Nearby.getConnectionsClient(requireNotNull(appContext.reactContext))
      stopInternal()
      sendEvent("onStatus", mapOf("state" to "starting", "peers" to 0))
      startAdvertising()
      startDiscovery()
    }
    AsyncFunction("broadcast") { data: String ->
      val bytes = data.toByteArray(StandardCharsets.UTF_8)
      require(bytes.size <= 32_000) { "Mensagem excede 32 KB" }
      val endpoints = synchronized(connected) { connected.toList() }
      if (endpoints.isNotEmpty()) client.sendPayload(endpoints, Payload.fromBytes(bytes))
      endpoints.size
    }
    AsyncFunction("stop") {
      stopInternal()
      sendStatus("stopped")
    }
    OnDestroy { stopInternal() }
  }

  private fun startAdvertising() {
    client.startAdvertising(
      endpointName,
      serviceId,
      lifecycleCallback,
      AdvertisingOptions.Builder().setStrategy(strategy).build(),
    ).addOnFailureListener { error ->
      sendEvent(
        "onStatus",
        mapOf(
          "state" to "error",
          "peers" to connected.size,
          "detail" to (error.message ?: "Falha ao anunciar"),
        ),
      )
    }
  }

  private fun startDiscovery() {
    client.startDiscovery(
      serviceId,
      discoveryCallback,
      DiscoveryOptions.Builder().setStrategy(strategy).build(),
    ).addOnSuccessListener { sendStatus("running") }
      .addOnFailureListener { error ->
        sendEvent(
          "onStatus",
          mapOf(
            "state" to "error",
            "peers" to connected.size,
            "detail" to (error.message ?: "Falha ao procurar"),
          ),
        )
      }
  }

  private val discoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      if (!info.endpointName.startsWith("${operationTag.take(8)}|")) return
      if (connected.contains(endpointId) || !pending.add(endpointId)) return
      client.requestConnection(endpointName, endpointId, lifecycleCallback)
        .addOnFailureListener { pending.remove(endpointId) }
    }

    override fun onEndpointLost(endpointId: String) {
      pending.remove(endpointId)
    }
  }

  private val lifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      if (!info.endpointName.startsWith("${operationTag.take(8)}|")) {
        client.rejectConnection(endpointId)
        return
      }
      client.acceptConnection(endpointId, payloadCallback)
    }

    override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
      pending.remove(endpointId)
      if (result.status.isSuccess) connected.add(endpointId) else connected.remove(endpointId)
      sendStatus("running")
    }

    override fun onDisconnected(endpointId: String) {
      connected.remove(endpointId)
      pending.remove(endpointId)
      sendStatus("running")
    }
  }

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      if (payload.type != Payload.Type.BYTES) return
      val bytes = payload.asBytes() ?: return
      sendEvent(
        "onMessage",
        mapOf("endpointId" to endpointId, "data" to String(bytes, StandardCharsets.UTF_8)),
      )
    }

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) = Unit
  }

  private fun stopInternal() {
    if (::client.isInitialized) {
      client.stopAdvertising()
      client.stopDiscovery()
      client.stopAllEndpoints()
    }
    connected.clear()
    pending.clear()
  }

  private fun sendStatus(state: String) {
    sendEvent("onStatus", mapOf("state" to state, "peers" to connected.size))
  }
}
