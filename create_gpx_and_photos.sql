-- Create table for GPX routes
CREATE TABLE public.trilha_gpx (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agenda_id UUID REFERENCES public.agendas(id) ON DELETE CASCADE,
    geojson JSONB NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for trilha_gpx
ALTER TABLE public.trilha_gpx ENABLE ROW LEVEL SECURITY;

-- Allow public read access to GPX routes
CREATE POLICY "Public can view GPX routes"
    ON public.trilha_gpx FOR SELECT
    USING (true);

-- Allow admins to manage GPX routes
CREATE POLICY "Admins can manage GPX routes"
    ON public.trilha_gpx FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create table for AI photos
CREATE TABLE public.fotos_trilhas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agenda_id UUID REFERENCES public.agendas(id) ON DELETE CASCADE,
    aws_url TEXT NOT NULL,
    aws_key TEXT NOT NULL,
    aws_face_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for fotos_trilhas
ALTER TABLE public.fotos_trilhas ENABLE ROW LEVEL SECURITY;

-- Allow public read access to photos
CREATE POLICY "Public can view photos"
    ON public.fotos_trilhas FOR SELECT
    USING (true);

-- Allow admins to manage photos
CREATE POLICY "Admins can manage photos"
    ON public.fotos_trilhas FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
