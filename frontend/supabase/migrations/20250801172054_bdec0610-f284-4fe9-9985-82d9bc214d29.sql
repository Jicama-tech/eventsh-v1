-- Create table to store Stripe configuration for different roles
CREATE TABLE public.stripe_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'shopkeeper')),
  stripe_secret_key TEXT,
  stripe_publishable_key TEXT,
  is_live_mode BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable Row Level Security
ALTER TABLE public.stripe_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for stripe_configs
CREATE POLICY "Users can manage their own stripe configs" 
ON public.stripe_configs 
FOR ALL 
USING (user_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_stripe_configs_updated_at
BEFORE UPDATE ON public.stripe_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();