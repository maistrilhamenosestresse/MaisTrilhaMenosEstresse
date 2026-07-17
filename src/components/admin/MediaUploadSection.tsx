import { useState, useRef } from "react";
import { X, UploadCloud, Map, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface MediaUploadSectionProps {
  agendaId: string;
}

export function MediaUploadSection({ agendaId }: MediaUploadSectionProps) {
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxSuccess, setGpxSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGpxSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGpxFile(e.target.files[0]);
      setGpxSuccess(false);
    }
  };

  const uploadGpx = async () => {
    if (!gpxFile) return;
    setGpxLoading(true);
    
    try {
      const text = await gpxFile.text();
      let geojson;
      
      if (gpxFile.name.toLowerCase().endsWith('.gpx') || text.includes('<?xml') || text.includes('<gpx')) {
        // Converter GPX para GeoJSON simples
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        // Verificar se é um XML válido
        const parseError = xmlDoc.getElementsByTagName("parsererror");
        if (parseError.length > 0) {
          alert("O arquivo GPX parece estar corrompido ou é inválido.");
          setGpxLoading(false);
          return;
        }

        const trackPoints = xmlDoc.getElementsByTagName("trkpt");
        if (trackPoints.length > 0) {
          const coordinates = Array.from(trackPoints).map(pt => {
            const lon = parseFloat(pt.getAttribute("lon") || "0");
            const lat = parseFloat(pt.getAttribute("lat") || "0");
            const eleNode = pt.getElementsByTagName("ele")[0];
            const ele = eleNode && eleNode.textContent ? parseFloat(eleNode.textContent) : 0;
            return [lon, lat, ele];
          });
          
          geojson = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates
                },
                properties: { name: gpxFile.name }
              }
            ]
          };
        } else {
          alert("Nenhuma coordenada encontrada neste arquivo GPX.");
          setGpxLoading(false);
          return;
        }
      } else {
        // Tentar parsear como GeoJSON (JSON normal)
        try {
          geojson = JSON.parse(text);
        } catch {
          alert("O arquivo precisa ser um GPX válido ou um JSON de coordenadas (GeoJSON).");
          setGpxLoading(false);
          return;
        }
      }

      // Avoid 'upsert' without a unique constraint on 'agenda_id'
      const { data: existing } = await supabase
        .from('trilha_gpx')
        .select('id')
        .eq('agenda_id', agendaId)
        .maybeSingle();

      let error;
      if (existing) {
        const res = await supabase
          .from('trilha_gpx')
          .update({ geojson })
          .eq('agenda_id', agendaId);
        error = res.error;
      } else {
        const res = await supabase
          .from('trilha_gpx')
          .insert({ agenda_id: agendaId, geojson });
        error = res.error;
      }

      if (error) throw error;
      setGpxSuccess(true);
      setGpxFile(null);
    } catch (e: any) {
      alert("Erro ao salvar mapa: " + e.message);
    } finally {
      setGpxLoading(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm mt-8">
      <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
        <div className="bg-blue-100 p-2 rounded-xl">
          <Map className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-800 leading-tight">Mapa da Trilha (GPX)</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Adicionar Rota Interativa 3D</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-700">Faça o upload do arquivo JSON de coordenadas gerado pelo GPS do Guia para desenhar a trilha exata na Área de Membros.</p>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleGpxSelect}
          className="hidden" 
        />
        
        {!gpxFile ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 hover:border-blue-300 transition-colors cursor-pointer group">
            <Map className="w-8 h-8 text-gray-300 group-hover:text-blue-500 transition-colors" />
            <span className="text-sm font-bold text-gray-600 group-hover:text-blue-600">Selecionar Arquivo de Mapa</span>
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <Map className="w-6 h-6 text-blue-600 shrink-0" />
              <span className="text-sm font-bold text-gray-700 truncate">{gpxFile.name}</span>
            </div>
            <button type="button" onClick={() => setGpxFile(null)} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><X className="w-4 h-4"/></button>
          </div>
        )}

        {gpxSuccess && (
          <div className="bg-green-50 text-green-700 text-sm font-bold p-3 rounded-xl flex items-center gap-2 justify-center">
            <CheckCircle2 className="w-4 h-4" /> Mapa atualizado com sucesso!
          </div>
        )}

        <button 
          type="button"
          disabled={!gpxFile || gpxLoading}
          onClick={uploadGpx}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {gpxLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
          {gpxLoading ? "Salvando no Banco..." : "Enviar Arquivo GPX"}
        </button>
      </div>
    </div>
  );
}
