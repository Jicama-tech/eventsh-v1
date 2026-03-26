-- Create website_content table for admin content management
CREATE TABLE public.website_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('faq', 'about_us', 'contact_us', 'terms', 'privacy', 'blog')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  author TEXT,
  slug TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;

-- Create policies for website content
CREATE POLICY "Admins can manage all website content" 
ON public.website_content 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Published content is publicly viewable" 
ON public.website_content 
FOR SELECT 
USING (is_published = true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_website_content_updated_at
BEFORE UPDATE ON public.website_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_website_content_type ON public.website_content(content_type);
CREATE INDEX idx_website_content_published ON public.website_content(is_published);
CREATE INDEX idx_website_content_slug ON public.website_content(slug);
CREATE INDEX idx_website_content_order ON public.website_content(content_type, order_index);