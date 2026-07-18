internal import ExpoModulesCore
import NearbyConnections

class NearbyMesh: Module {
  private var manager: ConnectionManager?
  private var advertiser: Advertiser?
  private var discoverer: Discoverer?
  private var connected = Set<EndpointID>()
  private var endpointContext = Data()
  private var operationTag = ""

  public func definition() -> ModuleDefinition {
    Events("onStatus", "onMessage")
    AsyncFunction("start") { (options: [String: String]) in
      guard let serviceId = options["serviceId"],
            let operationId = options["operationId"],
            let endpointName = options["endpointName"] else {
        throw NearbyMeshError.invalidConfiguration
      }
      self.stopMesh()
      self.operationTag = String(operationId.prefix(8))
      self.endpointContext = "\(self.operationTag)|\(endpointName.prefix(80))".data(using: .utf8)!
      let manager = ConnectionManager(serviceID: serviceId, strategy: .cluster)
      manager.delegate = self
      let advertiser = Advertiser(connectionManager: manager)
      advertiser.delegate = self
      let discoverer = Discoverer(connectionManager: manager)
      discoverer.delegate = self
      self.manager = manager
      self.advertiser = advertiser
      self.discoverer = discoverer
      advertiser.startAdvertising(using: self.endpointContext)
      discoverer.startDiscovery()
      self.emitStatus("running")
    }
    AsyncFunction("broadcast") { (data: String) -> Int in
      guard let bytes = data.data(using: .utf8), bytes.count <= 32_000 else {
        throw NearbyMeshError.payloadTooLarge
      }
      let endpoints = Array(self.connected)
      self.manager?.send(bytes, to: endpoints)
      return endpoints.count
    }
    AsyncFunction("stop") {
      self.stopMesh()
      self.emitStatus("stopped")
    }
    OnDestroy { self.stopMesh() }
  }

  private func stopMesh() {
    advertiser?.stopAdvertising()
    discoverer?.stopDiscovery()
    manager?.disconnectFromAllEndpoints()
    connected.removeAll()
    advertiser = nil
    discoverer = nil
    manager = nil
  }
  private func emitStatus(_ state: String, detail: String? = nil) {
    var body: [String: Any] = ["state": state, "peers": connected.count]
    if let detail { body["detail"] = detail }
    sendEvent("onStatus", body)
  }
}

extension NearbyMesh: AdvertiserDelegate {
  func advertiser(
    _ advertiser: Advertiser,
    didReceiveConnectionRequestFrom endpointID: EndpointID,
    with context: Data,
    connectionRequestHandler: @escaping (Bool) -> Void
  ) {
    connectionRequestHandler((String(data: context, encoding: .utf8) ?? "").hasPrefix("\(operationTag)|"))
  }
}

extension NearbyMesh: DiscovererDelegate {
  func discoverer(_ discoverer: Discoverer, didFind endpointID: EndpointID, with context: Data) {
    guard (String(data: context, encoding: .utf8) ?? "").hasPrefix("\(operationTag)|") else { return }
    discoverer.requestConnection(to: endpointID, using: endpointContext)
  }
  func discoverer(_ discoverer: Discoverer, didLose endpointID: EndpointID) {}
}

extension NearbyMesh: ConnectionManagerDelegate {
  func connectionManager(
    _ connectionManager: ConnectionManager,
    didReceive verificationCode: String,
    from endpointID: EndpointID,
    verificationHandler: @escaping (Bool) -> Void
  ) {
    verificationHandler(true)
  }
  func connectionManager(_ connectionManager: ConnectionManager, didChangeTo state: ConnectionState, for endpointID: EndpointID) {
    switch state {
    case .connected: connected.insert(endpointID)
    case .disconnected, .rejected: connected.remove(endpointID)
    default: break
    }
    emitStatus("running")
  }
  func connectionManager(_ connectionManager: ConnectionManager, didReceive data: Data, withID payloadID: PayloadID, from endpointID: EndpointID) {
    guard let text = String(data: data, encoding: .utf8) else { return }
    sendEvent("onMessage", ["endpointId": String(describing: endpointID), "data": text])
  }
  func connectionManager(_ connectionManager: ConnectionManager, didReceive stream: InputStream, withID payloadID: PayloadID, from endpointID: EndpointID, cancellationToken token: CancellationToken) {}
  func connectionManager(_ connectionManager: ConnectionManager, didStartReceivingResourceWithID payloadID: PayloadID, from endpointID: EndpointID, at localURL: URL, withName name: String, cancellationToken token: CancellationToken) {}
  func connectionManager(_ connectionManager: ConnectionManager, didReceiveTransferUpdate update: TransferUpdate, from endpointID: EndpointID, forPayload payloadID: PayloadID) {}
}

enum NearbyMeshError: Error {
  case invalidConfiguration
  case payloadTooLarge
}
