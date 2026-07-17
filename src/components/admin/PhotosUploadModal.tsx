import { useState, useRef } from "react";
import { X, UploadCloud, Image as ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PhotosUploadModalProps {
  agendaId: string | null;
  onClose: () => void;
}

export function PhotosUploadModal({ agendaId, onClose }: PhotosUploadModalProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'indexing' | 'success'>('idle');
  const photosInputRef = useRef<HTMLInputElement>(null);

  const handlePhotosSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
      setUploadStatus('idle');
      setUploadProgress(0);
    }
  };

  const uploadPhotos = async () => {
    if (photos.length === 0 || !agendaId) return;
    setUploadStatus('uploading');

    try {
      // 1. Pegar URLs Assinadas
      const fileMetas = photos.map(f => ({ name: f.name, size: f.size, type: f.type }));
      const res = await fetch('/api/ai/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendaId, files: fileMetas })
      });
      const { urls, error } = await res.json();
      if (error) throw new Error(error);

      // 2. Fazer Upload pro S3
      let completed = 0;
      const uploadedFiles = [];
      
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const urlData = urls[i];
        
        const uploadRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        
        if (!uploadRes.ok) throw new Error(`Falha ao enviar a foto ${file.name}`);
        
        completed++;
        setUploadProgress(Math.round((completed / photos.length) * 100));
        uploadedFiles.push(urlData);
      }

      // 3. Mandar pro Rekognition indexar
      setUploadStatus('indexing');
      
      for (const data of uploadedFiles) {
        await fetch('/api/ai/index-faces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agendaId, objectKey: data.objectKey, publicUrl: data.publicUrl })
        });
      }

      setUploadStatus('success');
      setPhotos([]);
    } catch (e: any) {
      alert("Erro no upload das fotos: " + e.message);
      setUploadStatus('idle');
    }
  };

  return (
    <AnimatePresence>
      {agendaId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
            <button 
              type="button" 
              onClick={onClose} 
              className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-xl">
                <ImageIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 leading-tight">Fotos da Trilha (IA)</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Mapeamento Facial Automático</p>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-xs text-purple-700">As fotos enviadas aqui serão processadas pela Amazon AWS para reconhecimento facial automático. Seus clientes poderão buscar fotos pelo próprio rosto na área de membros.</p>
              </div>

              <input type="file" multiple accept="image/*" ref={photosInputRef} onChange={handlePhotosSelect} className="hidden" />

              {uploadStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4 flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                  <p className="text-sm font-bold text-green-700">Fotos indexadas e salvas com sucesso!</p>
                  <button type="button" onClick={() => setUploadStatus('idle')} className="mt-2 text-xs font-bold text-green-600 hover:text-green-800 underline">
                    Fazer novo upload
                  </button>
                </div>
              )}

              <input type="file" multiple accept="image/*" ref={photosInputRef} onChange={handlePhotosSelect} className="hidden" />

              {photos.length === 0 && uploadStatus !== 'success' ? (
                <button type="button" onClick={() => photosInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 hover:bg-purple-50 hover:border-purple-300 transition-colors cursor-pointer group">
                  <UploadCloud className="w-10 h-10 text-gray-300 group-hover:text-purple-500 transition-colors" />
                  <span className="text-sm font-bold text-gray-600 group-hover:text-purple-600">Selecionar Centenas de Fotos</span>
                </button>
              ) : photos.length > 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 text-lg">{photos.length} Fotos Selecionadas</span>
                    {uploadStatus === 'idle' && (
                      <button type="button" onClick={() => setPhotos([])} className="text-sm font-bold text-red-500 hover:text-red-700">Cancelar</button>
                    )}
                  </div>

                  {(uploadStatus === 'uploading' || uploadStatus === 'indexing') && (
                    <div>
                      <div className="flex justify-between text-xs font-bold text-purple-700 mb-1">
                        <span>Enviando fotos...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div className="bg-purple-600 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {uploadStatus === 'indexing' && <p className="text-sm font-bold text-purple-600 flex items-center gap-2 animate-pulse"><Loader2 className="w-4 h-4 animate-spin"/> IA mapeando rostos... Isso pode demorar alguns minutos.</p>}
                </div>
              ) : null}

              <button 
                type="button"
                disabled={photos.length === 0 || uploadStatus !== 'idle'}
                onClick={uploadPhotos}
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
              >
                {uploadStatus === 'idle' && <UploadCloud className="w-5 h-5" />}
                {uploadStatus === 'uploading' || uploadStatus === 'indexing' ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {uploadStatus === 'success' && <CheckCircle2 className="w-5 h-5" />}
                
                {uploadStatus === 'idle' ? "Fazer Upload para IA" : 
                 uploadStatus === 'success' ? "Upload Concluído" : "Processando..."}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
