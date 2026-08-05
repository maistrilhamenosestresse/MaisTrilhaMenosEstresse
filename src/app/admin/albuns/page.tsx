"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  CloudDownload,
  Eye,
  ExternalLink,
  FileImage,
  Film,
  Images,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type AlbumSummary = {
  agendaId: string;
  agendaTitle: string;
  agendaDate: string;
  location: string | null;
  coverUrl: string | null;
  title: string;
  description: string;
  photographer: string;
  published: boolean;
  mediaCount: number;
  imageCount: number;
  videoCount: number;
  updatedAt: string | null;
};

type AlbumMedia = {
  id: string;
  url: string;
  type: "image" | "video";
  faceCount: number;
  label: string;
};

type Draft = Pick<AlbumSummary, "title" | "description" | "photographer" | "published">;
type MobileStep = "details" | "upload" | "media";
type GoogleImportJob = {
  id: string;
  agendaId: string;
  status: "awaiting_selection" | "queued" | "processing" | "completed" | "completed_with_errors" | "failed" | "expired" | "cancelled";
  pickerUri: string | null;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errorMessage: string | null;
};

export default function AdminAlbumsPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [media, setMedia] = useState<AlbumMedia[]>([]);
  const [draft, setDraft] = useState<Draft>({ title: "", description: "", photographer: "", published: true });
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<AlbumMedia | null>(null);
  const [mobileStep, setMobileStep] = useState<MobileStep>("details");
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [googleImportJobId, setGoogleImportJobId] = useState("");
  const [googleImportJob, setGoogleImportJob] = useState<GoogleImportJob | null>(null);
  const [startingGoogleImport, setStartingGoogleImport] = useState(false);
  const googleSyncingRef = useRef(false);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.agendaId === selectedId) || null,
    [albums, selectedId],
  );
  const filteredAlbums = useMemo(() => {
    const query = normalize(search);
    if (!query) return albums;
    return albums.filter((album) => normalize(`${album.agendaTitle} ${album.title} ${album.location || ""}`).includes(query));
  }, [albums, search]);

  const applyDraft = useCallback((album: AlbumSummary | null) => {
    setDraft({
      title: album?.title || "",
      description: album?.description || "",
      photographer: album?.photographer || "Equipe Mais Trilha Menos Estresse",
      published: album?.published !== false,
    });
  }, []);

  const loadAlbumDetails = useCallback(async (agendaId: string) => {
    if (!agendaId) return;
    setLoadingMedia(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/albums?agendaId=${encodeURIComponent(agendaId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao abrir o álbum");
      setAlbums(result.albums || []);
      setMedia(result.media || []);
      setSelectedMediaIds(new Set());
      applyDraft(result.album || null);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível abrir o álbum" });
      setMedia([]);
    } finally {
      setLoadingMedia(false);
    }
  }, [applyDraft]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/admin/albums", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Falha ao carregar os álbuns");
        const nextAlbums = result.albums || [];
        setAlbums(nextAlbums);
        if (nextAlbums.length) {
          setSelectedId(nextAlbums[0].agendaId);
          await loadAlbumDetails(nextAlbums[0].agendaId);
        }
      } catch (error) {
        setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível carregar os álbuns" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadAlbumDetails]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("googleImportJob") || "";
    const importError = params.get("googleImportError");
    if (jobId) setGoogleImportJobId(jobId);
    if (importError) setMessage({ kind: "error", text: importError });
    if (jobId || importError) {
      params.delete("googleImportJob");
      params.delete("googleAlbumAgenda");
      params.delete("googleImportError");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
  }, []);

  const selectAlbum = (album: AlbumSummary) => {
    if (googleImportJob?.agendaId && googleImportJob.agendaId !== album.agendaId) {
      setGoogleImportJobId("");
      setGoogleImportJob(null);
    }
    setSelectedId(album.agendaId);
    setMobileStep("details");
    setFiles([]);
    setUploadProgress(0);
    setSelectedMediaIds(new Set());
    applyDraft(album);
    void loadAlbumDetails(album.agendaId);
  };

  const saveMetadata = async (showSuccess = true) => {
    if (!selectedId) return false;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/albums", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agendaId: selectedId, ...draft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao salvar os dados do álbum");
      setAlbums((current) => current.map((album) => album.agendaId === selectedId ? { ...album, ...draft } : album));
      if (showSuccess) setMessage({ kind: "success", text: "Informações do álbum salvas com segurança." });
      return true;
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível salvar" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startGooglePhotosImport = async () => {
    if (!selectedId || startingGoogleImport) return;
    setStartingGoogleImport(true);
    setMessage(null);
    try {
      const metadataSaved = await saveMetadata(false);
      if (!metadataSaved) throw new Error("Salve o nome do álbum antes de conectar o Google Fotos.");
      const response = await fetch("/api/admin/albums/google/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agendaId: selectedId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.authorizationUrl) throw new Error(result.error || "Não foi possível conectar o Google Fotos");
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Falha ao conectar o Google Fotos" });
      setStartingGoogleImport(false);
    }
  };

  const syncGooglePhotosImport = useCallback(async (jobId: string) => {
    if (!jobId || googleSyncingRef.current) return;
    googleSyncingRef.current = true;
    try {
      const response = await fetch(`/api/admin/albums/google/jobs/${encodeURIComponent(jobId)}`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.job) throw new Error(result.error || "Falha ao acompanhar a importação");
      const job = result.job as GoogleImportJob;
      setGoogleImportJob(job);
      if (job.agendaId && job.agendaId !== selectedId) {
        const album = albums.find((candidate) => candidate.agendaId === job.agendaId);
        setSelectedId(job.agendaId);
        setMobileStep("upload");
        if (album) applyDraft(album);
        await loadAlbumDetails(job.agendaId);
      }
      if (["completed", "completed_with_errors"].includes(job.status)) {
        await loadAlbumDetails(job.agendaId);
        setMessage({
          kind: job.status === "completed" ? "success" : "error",
          text: job.status === "completed"
            ? `${job.processedItems} arquivo(s) importado(s) do Google Fotos para a AWS.`
            : `Importação finalizada: ${job.processedItems} concluído(s) e ${job.failedItems} com falha.`,
        });
      }
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível acompanhar a importação" });
    } finally {
      googleSyncingRef.current = false;
    }
  }, [albums, applyDraft, loadAlbumDetails, selectedId]);

  useEffect(() => {
    if (!googleImportJobId || ["completed", "completed_with_errors", "failed", "expired", "cancelled"].includes(googleImportJob?.status || "")) return;
    void syncGooglePhotosImport(googleImportJobId);
    const timer = window.setInterval(() => void syncGooglePhotosImport(googleImportJobId), 4000);
    return () => window.clearInterval(timer);
  }, [googleImportJob?.status, googleImportJobId, syncGooglePhotosImport]);

  const addFiles = (incoming: File[]) => {
    const allowed = incoming.filter((file) => [
      "image/jpeg", "image/png", "video/mp4", "video/quicktime", "video/x-m4v",
    ].includes(file.type));
    const combined = [...files, ...allowed].slice(0, 100);
    setFiles(combined);
    if (allowed.length !== incoming.length) {
      setMessage({ kind: "error", text: "Alguns arquivos foram ignorados. Use JPG, PNG, MP4 ou MOV." });
    } else {
      setMessage(null);
    }
  };

  const upload = async () => {
    if (!selectedId || !files.length || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    setMessage(null);
    try {
      const metadataSaved = await saveMetadata(false);
      if (!metadataSaved) throw new Error("Revise o nome e os detalhes do álbum antes de enviar.");

      setUploadStep("Preparando envio seguro para a AWS");
      const response = await fetch("/api/ai/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendaId: selectedId,
          files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        }),
      });
      const prepared = await response.json();
      if (!response.ok || !Array.isArray(prepared.urls)) {
        throw new Error(prepared.error || "Não foi possível preparar o envio");
      }

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const destination = prepared.urls[index];
        setUploadStep(`Enviando ${index + 1} de ${files.length}: ${file.name}`);
        const uploadResponse = await fetch(destination.signedUrl, {
          method: "PUT",
          headers: destination.requiredHeaders || {
            "Content-Type": file.type,
            "x-amz-server-side-encryption": "AES256",
          },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error(`A AWS recusou ${file.name} (código ${uploadResponse.status}). Tente novamente.`);
        }

        setUploadStep(file.type.startsWith("image/")
          ? `Organizando e reconhecendo rostos em ${file.name}`
          : `Registrando ${file.name} no álbum`);
        const indexResponse = await fetch("/api/ai/index-faces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agendaId: selectedId,
            objectKey: destination.objectKey,
            contentType: destination.contentType,
          }),
        });
        const indexResult = await indexResponse.json().catch(() => ({}));
        if (!indexResponse.ok) throw new Error(indexResult.error || `Falha ao processar ${file.name}`);
        setUploadProgress(Math.round(((index + 1) / files.length) * 100));
      }

      setFiles([]);
      setUploadStep("Álbum atualizado");
      setMessage({ kind: "success", text: "Arquivos enviados para a AWS e organizados no álbum." });
      await loadAlbumDetails(selectedId);
      setMobileStep("media");
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Falha no envio" });
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (item: AlbumMedia) => {
    if (!window.confirm(`Excluir ${item.label} definitivamente do álbum e da AWS?`)) return;
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/albums/${item.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao excluir o arquivo");
      setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id));
      setSelectedMediaIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      setAlbums((current) => current.map((album) => album.agendaId === selectedId
        ? {
            ...album,
            mediaCount: Math.max(0, album.mediaCount - 1),
            imageCount: Math.max(0, album.imageCount - (item.type === "image" ? 1 : 0)),
            videoCount: Math.max(0, album.videoCount - (item.type === "video" ? 1 : 0)),
          }
        : album));
      setMessage({ kind: "success", text: `${item.label} excluído do álbum.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível excluir" });
    }
  };

  const toggleMediaSelection = (mediaId: string) => {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  };

  const toggleAllMedia = () => {
    setSelectedMediaIds((current) => current.size === media.length
      ? new Set()
      : new Set(media.map((item) => item.id)));
  };

  const removeSelectedMedia = async () => {
    const selectedItems = media.filter((item) => selectedMediaIds.has(item.id));
    if (!selectedId || !selectedItems.length || deletingBulk) return;
    if (!window.confirm(`Excluir definitivamente ${selectedItems.length} arquivo(s) do álbum e da AWS? Esta ação não pode ser desfeita.`)) return;

    setDeletingBulk(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/albums/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agendaId: selectedId, mediaIds: selectedItems.map((item) => item.id) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Falha ao excluir os arquivos selecionados");

      const deletedIds = new Set(selectedItems.map((item) => item.id));
      const deletedImages = selectedItems.filter((item) => item.type === "image").length;
      const deletedVideos = selectedItems.filter((item) => item.type === "video").length;
      setMedia((current) => current.filter((item) => !deletedIds.has(item.id)));
      setAlbums((current) => current.map((album) => album.agendaId === selectedId
        ? {
            ...album,
            mediaCount: Math.max(0, album.mediaCount - selectedItems.length),
            imageCount: Math.max(0, album.imageCount - deletedImages),
            videoCount: Math.max(0, album.videoCount - deletedVideos),
          }
        : album));
      setSelectedMediaIds(new Set());
      const hasWarnings = Array.isArray(result.cleanupWarnings) && result.cleanupWarnings.length > 0;
      setMessage({
        kind: "success",
        text: `${selectedItems.length} arquivo(s) excluído(s) com sucesso.${hasWarnings ? " Alguns arquivos externos exigirão uma nova tentativa de limpeza." : ""}`,
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível excluir a seleção" });
    } finally {
      setDeletingBulk(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#F4F7FA]"><Loader2 className="h-9 w-9 animate-spin text-[#0B2540]" /></div>;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F4F7FA] pb-24 text-slate-900 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3">
          <button type="button" onClick={() => router.push("/admin")} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-[#0B2540]" aria-label="Voltar ao painel">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D96224]">Central de memórias</p>
            <h1 className="truncate text-base font-black text-[#071829] sm:text-xl">Álbuns, fotos e reconhecimento</h1>
          </div>
          <a href="/album" target="_blank" rel="noreferrer" className="hidden min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#0B2540] sm:flex">
            <Eye className="h-4 w-4" /> Portal do cliente
          </a>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] gap-4 p-3 sm:p-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5 lg:p-6">
        <aside className="hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-7rem)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar trilha ou álbum" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200" />
          </div>
          <div className="mt-4 max-h-[calc(100vh-12rem)] space-y-2 overflow-y-auto pr-1">
            {filteredAlbums.map((album) => (
              <button key={album.agendaId} type="button" onClick={() => selectAlbum(album)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === album.agendaId ? "border-[#D96224] bg-orange-50 ring-2 ring-orange-100" : "border-slate-200 hover:bg-slate-50"}`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selectedId === album.agendaId ? "bg-[#D96224] text-white" : "bg-[#E7EEF6] text-[#0B2540]"}`}><Images className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-800">{album.agendaTitle}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays className="h-3 w-3" /> {formatDate(album.agendaDate)} · {album.mediaCount} arquivos</span>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase ${album.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{album.published ? "Disponível" : "Oculto"}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-3 sm:space-y-5">
          {albums.length ? (
            <section className="rounded-2xl border border-[#D96224]/25 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <label className="block min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#D96224]">
                    <CalendarDays className="h-4 w-4" /> Selecione a trilha do álbum
                  </span>
                  <span className="mt-1 hidden text-xs text-slate-500 sm:block">Escolha a viagem antes de editar as informações ou adicionar arquivos.</span>
                  <span className="relative mt-2 block sm:mt-3">
                    <select
                      value={selectedId}
                      onChange={(event) => {
                        const album = albums.find((item) => item.agendaId === event.target.value);
                        if (album) selectAlbum(album);
                      }}
                      className="min-h-12 w-full appearance-none rounded-xl border-2 border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-black text-[#071829] outline-none transition focus:border-[#D96224] focus:ring-4 focus:ring-orange-100 sm:min-h-14 sm:rounded-2xl sm:px-4 sm:pr-12"
                    >
                      {albums.map((album) => (
                        <option key={album.agendaId} value={album.agendaId}>
                          {formatDate(album.agendaDate)} — {album.agendaTitle} ({album.mediaCount} arquivos)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D96224]" />
                  </span>
                </label>
                <a
                  href="#editar-album"
                  onClick={() => setMobileStep("details")}
                  className="hidden min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#D96224] px-5 text-sm font-black text-white shadow-lg shadow-orange-900/15 transition hover:-translate-y-0.5 hover:bg-[#bf4f18] md:inline-flex"
                >
                  <Pencil className="h-4 w-4" /> Editar álbum selecionado
                </a>
              </div>
            </section>
          ) : null}

          {selectedAlbum ? (
            <nav className="sticky top-[69px] z-30 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-xl md:hidden" aria-label="Etapas do álbum">
              <MobileStepButton active={mobileStep === "details"} icon={Pencil} label="Informações" onClick={() => setMobileStep("details")} />
              <MobileStepButton active={mobileStep === "upload"} icon={UploadCloud} label="Enviar" onClick={() => setMobileStep("upload")} />
              <MobileStepButton active={mobileStep === "media"} icon={Images} label={`Arquivos (${media.length})`} onClick={() => setMobileStep("media")} />
            </nav>
          ) : null}

          {!selectedAlbum ? (
            <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div>
                <Images className="mx-auto h-12 w-12 text-slate-300" />
                <h2 className="mt-4 text-xl font-black">{message?.kind === "error" ? "Não foi possível carregar as trilhas" : "Nenhuma trilha disponível"}</h2>
                <p className="mt-2 max-w-md text-sm text-slate-500">{message?.text || "Cadastre uma trilha antes de criar o álbum."}</p>
                {message?.kind === "error" ? (
                  <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0B2540] px-5 text-sm font-black text-white">
                    <RefreshCw className="h-4 w-4" /> Tentar novamente
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#061526,#12385E)] text-white shadow-xl sm:rounded-3xl">
                <div className="relative">
                  {selectedAlbum.coverUrl ? <img src={selectedAlbum.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-10" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#061526] via-[#061526]/95 to-[#12385E]/85" />
                <div className="relative grid gap-3 p-4 md:grid-cols-[1fr_auto] md:gap-5 md:p-7">
                  <div>
                    <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-200 sm:inline-flex"><Sparkles className="h-3 w-3" /> Álbum inteligente AWS</span>
                    <h2 className="text-lg font-black sm:mt-4 sm:text-2xl md:text-3xl">{draft.title || selectedAlbum.agendaTitle}</h2>
                    <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-relaxed text-blue-100/75 sm:mt-2 sm:text-sm">{draft.description}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 self-end md:w-72">
                    <Metric icon={Images} value={selectedAlbum.mediaCount} label="arquivos" />
                    <Metric icon={FileImage} value={selectedAlbum.imageCount} label="fotos" />
                    <Metric icon={Film} value={selectedAlbum.videoCount} label="vídeos" />
                  </div>
                </div>
                </div>
              </section>

              {message ? <div className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-bold ${message.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}><span className="flex items-start gap-2">{message.kind === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <X className="h-5 w-5 shrink-0" />}{message.text}</span><button type="button" onClick={() => setMessage(null)}><X className="h-4 w-4" /></button></div> : null}

              <section id="editar-album" className={`${mobileStep === "details" ? "block" : "hidden"} scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5 md:block md:p-7`}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div><h2 className="text-xl font-black">1. Informações do álbum</h2><p className="mt-1 text-sm text-slate-500">Esses textos aparecem para o cliente ao abrir as lembranças.</p></div>
                  <button type="button" onClick={() => void saveMetadata()} disabled={saving || draft.title.trim().length < 3} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0B2540] px-5 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar informações</button>
                </div>
                <div className="mt-4 grid gap-4 md:mt-5 md:grid-cols-2">
                  <Field label="Nome do álbum" help="Ex.: Memórias da Expedição Pico da Bandeira"><input value={draft.title} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" /></Field>
                  <Field label="Créditos das fotos" help="Fotógrafo, guia ou equipe responsável"><input value={draft.photographer} maxLength={120} onChange={(event) => setDraft({ ...draft, photographer: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" /></Field>
                  <Field label="Mensagem para os participantes" help="Conte o que torna estas lembranças especiais" wide><textarea value={draft.description} maxLength={800} rows={4} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" /></Field>
                  <label className="md:col-span-2 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <span><span className="block text-sm font-black">Disponível para os participantes</span><span className="mt-1 block text-xs text-slate-500">Desative enquanto ainda estiver organizando as fotos.</span></span>
                    <input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} className="h-6 w-6 accent-[#D96224]" />
                  </label>
                </div>
              </section>

              <section className={`${mobileStep === "upload" ? "block" : "hidden"} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5 md:block md:p-7`}>
                <div><h2 className="text-xl font-black">2. Enviar fotos e vídeos</h2><p className="mt-1 text-sm text-slate-500">Os originais vão para a AWS. Fotos JPG/PNG recebem reconhecimento facial; vídeos são organizados sem análise de rosto.</p></div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[#10243A] sm:mt-5 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#D96224] shadow-sm"><CloudDownload className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D96224]">Google Fotos</p>
                      <h3 className="mt-1 text-base font-black sm:text-lg">Trazer um álbum do Google Fotos</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">Escolha somente as fotos e os vídeos desta trilha. O envio continua em segundo plano e você pode fechar esta página.</p>
                    </div>
                  </div>

                  {googleImportJob ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black">{googleImportStatusLabel(googleImportJob.status)}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{googleImportJob.processedItems + googleImportJob.failedItems} de {googleImportJob.totalItems || "—"}</span>
                      </div>
                      {googleImportJob.totalItems > 0 ? (
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><motion.div className="h-full rounded-full bg-[#D96224]" animate={{ width: `${Math.min(100, ((googleImportJob.processedItems + googleImportJob.failedItems) / googleImportJob.totalItems) * 100)}%` }} /></div>
                      ) : null}
                      {googleImportJob.errorMessage ? <p className="mt-2 text-[11px] font-bold text-red-600">{googleImportJob.errorMessage}</p> : null}
                      {googleImportJob.status === "awaiting_selection" && googleImportJob.pickerUri ? (
                        <button type="button" onClick={() => window.open(googleImportJob.pickerUri || "", "google-photos-picker", "popup,width=920,height=760")} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#10243A] px-4 text-xs font-black text-white"><ExternalLink className="h-4 w-4" /> Escolher fotos no Google</button>
                      ) : null}
                      {["failed", "expired", "cancelled"].includes(googleImportJob.status) ? (
                        <button type="button" onClick={() => { setGoogleImportJob(null); setGoogleImportJobId(""); void startGooglePhotosImport(); }} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F17B37] px-4 text-xs font-black text-white"><RefreshCw className="h-4 w-4" /> Conectar novamente</button>
                      ) : null}
                    </div>
                  ) : (
                    <button type="button" onClick={() => void startGooglePhotosImport()} disabled={startingGoogleImport || saving || draft.title.trim().length < 3} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10243A] px-5 text-sm font-black text-white disabled:opacity-50">
                      {startingGoogleImport ? <Loader2 className="h-5 w-5 animate-spin" /> : <CloudDownload className="h-5 w-5 text-[#D96224]" />}
                      {startingGoogleImport ? "Conectando com segurança..." : "Conectar Google Fotos"}
                    </button>
                  )}
                </div>

                <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">ou envie do aparelho</span><span className="h-px flex-1 bg-slate-200" /></div>
                <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime,video/x-m4v" onChange={(event) => addFiles(Array.from(event.target.files || []))} className="hidden" />
                <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }} className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-5 text-center transition hover:border-[#D96224] hover:bg-orange-50 sm:mt-5 sm:rounded-3xl sm:p-8">
                  <UploadCloud className="h-10 w-10 text-[#D96224]" /><span className="mt-3 font-black">Selecionar ou arrastar arquivos</span><span className="mt-1 text-xs text-slate-500">Até 100 arquivos por envio · JPG/PNG até 20 MB · MP4/MOV até 500 MB</span>
                </button>
                {files.length ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-black">{files.length} arquivo(s) na fila</p><button type="button" onClick={() => setFiles([])} disabled={uploading} className="text-xs font-black text-red-600">Limpar fila</button></div><div className="mt-3 max-h-44 space-y-2 overflow-y-auto">{files.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 rounded-xl bg-white p-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#E7EEF6] text-[#0B2540]">{file.type.startsWith("video/") ? <Film className="h-4 w-4" /> : <FileImage className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{file.name}</span><span className="text-[10px] text-slate-400">{formatBytes(file.size)}</span></span><button type="button" disabled={uploading} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="p-2 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button></div>)}</div></div> : null}
                {uploading || uploadProgress > 0 ? <div className="mt-4 rounded-2xl bg-[#071829] p-4 text-white"><div className="flex items-center justify-between gap-3 text-xs font-bold"><span className="truncate">{uploadStep}</span><span>{uploadProgress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#F17B37,#FDBA74)]" animate={{ width: `${uploadProgress}%` }} /></div></div> : null}
                <button type="button" onClick={() => void upload()} disabled={uploading || saving || !files.length || draft.title.trim().length < 3} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#D96224] px-5 font-black text-white shadow-lg shadow-orange-900/15 disabled:opacity-50">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />} {uploading ? "Enviando e organizando..." : "Enviar para o álbum"}</button>
              </section>

              <section className={`${mobileStep === "media" ? "block" : "hidden"} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5 md:block md:p-7`}>
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="text-xl font-black">3. Arquivos publicados</h2><p className="mt-1 text-sm text-slate-500">Selecione arquivos para excluir vários de uma vez.</p></div>
                  <button type="button" onClick={() => void loadAlbumDetails(selectedId)} disabled={loadingMedia} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#0B2540]" aria-label="Atualizar arquivos"><RefreshCw className={`h-4 w-4 ${loadingMedia ? "animate-spin" : ""}`} /></button>
                </div>
                {media.length && !loadingMedia ? (
                  <div className="sticky top-[4.7rem] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-lg backdrop-blur-xl md:static md:shadow-none">
                    <button type="button" onClick={toggleAllMedia} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-black text-[#0B2540]">
                      {selectedMediaIds.size === media.length ? <CheckSquare className="h-4 w-4 text-[#D96224]" /> : <Square className="h-4 w-4" />}
                      {selectedMediaIds.size === media.length ? "Limpar seleção" : "Selecionar tudo"}
                    </button>
                    <span className="min-w-0 flex-1 text-right text-xs font-bold text-slate-500 sm:text-left">{selectedMediaIds.size} de {media.length}</span>
                    {selectedMediaIds.size ? (
                      <button type="button" onClick={() => void removeSelectedMedia()} disabled={deletingBulk} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-3 text-xs font-black text-white shadow-md disabled:opacity-50">
                        {deletingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Excluir selecionados
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {loadingMedia ? (
                  <div className="grid min-h-52 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#D96224]" /></div>
                ) : media.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {media.map((item, index) => {
                      const selected = selectedMediaIds.has(item.id);
                      return (
                        <motion.article key={item.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(index * 0.025, 0.25) }} className={`group relative aspect-square overflow-hidden rounded-2xl border-2 bg-slate-900 transition ${selected ? "border-[#F17B37] ring-4 ring-orange-200" : "border-transparent"}`}>
                          {item.type === "video" ? <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" /> : <img src={item.url} alt={item.label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />}
                          <button type="button" onClick={() => toggleMediaSelection(item.id)} className={`absolute left-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full border-2 shadow-lg backdrop-blur-md ${selected ? "border-orange-200 bg-[#D96224] text-white" : "border-white bg-black/40 text-white"}`} aria-label={selected ? `Desmarcar ${item.label}` : `Selecionar ${item.label}`}>
                            {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
                            <span className="min-w-0"><span className="block truncate text-[11px] font-black text-white">{item.label}</span><span className="text-[9px] text-white/65">{item.type === "image" ? `${item.faceCount} rosto(s)` : "Vídeo"}</span></span>
                            <span className="flex shrink-0 gap-1"><button type="button" onClick={() => setPreview(item)} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md" aria-label={`Visualizar ${item.label}`}><Eye className="h-4 w-4" /></button><button type="button" onClick={() => void removeMedia(item)} className="grid h-8 w-8 place-items-center rounded-full bg-red-500/90 text-white" aria-label={`Excluir ${item.label}`}><Trash2 className="h-4 w-4" /></button></span>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 grid min-h-52 place-items-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 text-center"><div><Camera className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-slate-600">Álbum ainda vazio</p><p className="mt-1 text-xs text-slate-400">Envie os primeiros arquivos na etapa acima.</p></div></div>
                )}
              </section>
            </>
          )}
        </section>
      </div>

      <AnimatePresence>{preview ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur-lg" onClick={() => setPreview(null)}><button type="button" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white" onClick={() => setPreview(null)}><X className="h-6 w-6" /></button><motion.div initial={{ scale: 0.94 }} animate={{ scale: 1 }} className="max-h-[88vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>{preview.type === "video" ? <video src={preview.url} controls autoPlay playsInline className="max-h-[85vh] max-w-full rounded-2xl" /> : <img src={preview.url} alt={preview.label} className="max-h-[85vh] max-w-full rounded-2xl object-contain" />}</motion.div></motion.div> : null}</AnimatePresence>
    </main>
  );
}

function MobileStepButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Images; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-black transition ${active ? "bg-[#0B2540] text-white shadow-md" : "text-slate-500"}`}
      aria-current={active ? "step" : undefined}
    >
      <Icon className={`h-4 w-4 ${active ? "text-orange-300" : "text-slate-400"}`} />
      <span className="w-full truncate text-center">{label}</span>
    </button>
  );
}

function Field({ label, help, wide = false, children }: { label: string; help: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "md:col-span-2" : ""}><span className="block text-xs font-black uppercase tracking-wider text-slate-600">{label}</span><span className="mt-1 block text-[11px] text-slate-400">{help}</span><span className="mt-2 block">{children}</span></label>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Images; value: number; label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"><Icon className="mx-auto h-4 w-4 text-orange-200" /><strong className="mt-1 block text-xl font-black">{value}</strong><span className="text-[9px] uppercase tracking-wider text-blue-100/60">{label}</span></div>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function googleImportStatusLabel(status: GoogleImportJob["status"]) {
  const labels: Record<GoogleImportJob["status"], string> = {
    awaiting_selection: "Aguardando sua seleção no Google Fotos",
    queued: "Arquivos na fila segura da AWS",
    processing: "Transferindo originais e reconhecendo rostos",
    completed: "Importação concluída",
    completed_with_errors: "Importação concluída com pendências",
    failed: "Importação interrompida",
    expired: "Seleção expirada",
    cancelled: "Importação cancelada",
  };
  return labels[status];
}

function formatDate(value: string) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
