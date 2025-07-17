-- Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
);

-- Create storage policies for menu images
CREATE POLICY "Menu images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'menu-images');

CREATE POLICY "Restaurant owners can upload menu images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'menu-images'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.owner_id = auth.uid()
    AND (storage.foldername(name))[2] = r.id::text
  )
);

CREATE POLICY "Restaurant owners can update their menu images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'menu-images'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.owner_id = auth.uid()
    AND (storage.foldername(name))[2] = r.id::text
  )
);

CREATE POLICY "Restaurant owners can delete their menu images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'menu-images'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.owner_id = auth.uid()
    AND (storage.foldername(name))[2] = r.id::text
  )
);