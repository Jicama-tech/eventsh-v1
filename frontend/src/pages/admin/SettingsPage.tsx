import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  FileText,
  HelpCircle,
  Users,
  Phone,
  Shield,
  BookOpen,
  Globe,
  Calendar,
  RefreshCw,
  CreditCard,
  Lock,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContentItem {
  id: string;
  content_type:
    | "faq"
    | "about_us"
    | "contact_us"
    | "terms"
    | "privacy"
    | "blog";
  title: string;
  content: string;
  meta_description?: string;
  is_published: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  author?: string;
  slug?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

const contentTypes = [
  {
    key: "faq",
    label: "FAQ",
    icon: HelpCircle,
    description: "Frequently Asked Questions",
  },
  {
    key: "about_us",
    label: "About Us",
    icon: Users,
    description: "Company information and story",
  },
  {
    key: "contact_us",
    label: "Contact Us",
    icon: Phone,
    description: "Contact information and form",
  },
  {
    key: "terms",
    label: "Terms & Conditions",
    icon: Shield,
    description: "Terms of service",
  },
  {
    key: "privacy",
    label: "Privacy Policy",
    icon: Shield,
    description: "Privacy policy",
  },
  {
    key: "blog",
    label: "Blog Posts",
    icon: BookOpen,
    description: "Blog articles and updates",
  },
];

export function SettingsPage() {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("content");
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<string>("faq");
  const [formData, setFormData] = useState<Partial<ContentItem>>({
    content_type: "faq",
    title: "",
    content: "",
    meta_description: "",
    is_published: false,
    order_index: 0,
    author: "",
    slug: "",
  });

  const [stripeSettings, setStripeSettings] = useState({
    secretKey: "",
    publishableKey: "",
    isLiveMode: false,
    isActive: true,
  });

  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchContentItems();
  }, []);

  const fetchContentItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("website_content")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContentItems((data || []) as ContentItem[]);
    } catch (error) {
      console.error("Error fetching content:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to fetch content items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContent = async () => {
    try {
      const { error } = await supabase.from("website_content").insert([
        {
          content_type: formData.content_type,
          title: formData.title || "",
          content: formData.content || "",
          meta_description: formData.meta_description,
          is_published: formData.is_published || false,
          order_index: formData.order_index || 0,
          author: formData.author,
          slug:
            formData.slug || formData.title?.toLowerCase().replace(/\s+/g, "-"),
        },
      ]);

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Success",
        description: "Content item created successfully",
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchContentItems();
    } catch (error) {
      console.error("Error creating content:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to create content item",
        variant: "destructive",
      });
    }
  };

  const handleUpdateContent = async (
    itemId: string,
    updates: Partial<ContentItem>
  ) => {
    try {
      const { error } = await supabase
        .from("website_content")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Success",
        description: "Content item updated successfully",
      });

      fetchContentItems();
    } catch (error) {
      console.error("Error updating content:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to update content item",
        variant: "destructive",
      });
    }
  };

  const handleDeleteContent = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this content item?")) return;

    try {
      const { error } = await supabase
        .from("website_content")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Success",
        description: "Content item deleted successfully",
      });

      fetchContentItems();
    } catch (error) {
      console.error("Error deleting content:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to delete content item",
        variant: "destructive",
      });
    }
  };

  const togglePublishStatus = async (itemId: string, isPublished: boolean) => {
    await handleUpdateContent(itemId, { is_published: isPublished });
  };

  const resetForm = () => {
    setFormData({
      content_type: "faq",
      title: "",
      content: "",
      meta_description: "",
      is_published: false,
      order_index: 0,
      author: "",
      slug: "",
    });
    setEditingItem(null);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const ContentFormDialog = ({
    isOpen,
    onClose,
    item = null,
  }: {
    isOpen: boolean;
    onClose: () => void;
    item?: ContentItem | null;
  }) => {
    const isEditing = !!item;

    useEffect(() => {
      if (item) {
        setFormData({ ...item });
      } else {
        resetForm();
      }
    }, [item]);

    const handleSubmit = () => {
      if (isEditing) {
        handleUpdateContent(item!.id, formData);
        onClose();
      } else {
        handleCreateContent();
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Content" : "Create New Content"}
            </DialogTitle>
            <DialogDescription>
              Manage website content that will be displayed on the landing page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Content Type & Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contentType">Content Type *</Label>
                <select
                  className="w-full p-2 border rounded-md bg-background z-50 relative"
                  value={formData.content_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      content_type: e.target.value as any,
                    })
                  }
                  disabled={isEditing}
                >
                  {contentTypes.map((type) => (
                    <option key={type.key} value={type.key}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setFormData({
                      ...formData,
                      title,
                      slug: generateSlug(title),
                    });
                  }}
                  placeholder="Enter content title"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="url-friendly-slug"
                />
              </div>
              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData({ ...formData, author: e.target.value })
                  }
                  placeholder="Content author"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                value={formData.meta_description}
                onChange={(e) =>
                  setFormData({ ...formData, meta_description: e.target.value })
                }
                placeholder="Brief description for SEO (150-160 characters)"
                rows={2}
              />
            </div>

            {/* Content Editor */}
            <div>
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder={
                  formData.content_type === "faq"
                    ? 'Enter FAQ items in JSON format: [{"question": "...", "answer": "..."}]'
                    : "Enter your content here... (Supports HTML)"
                }
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.content_type === "faq"
                  ? "Use JSON format for FAQ items with question/answer pairs"
                  : "HTML tags are supported for rich formatting"}
              </p>
            </div>

            {/* Settings */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_published}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_published: checked })
                    }
                  />
                  <Label>Publish to website</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  When enabled, this content will be visible on the public
                  website
                </p>
              </div>
              <div className="text-right">
                <Label htmlFor="orderIndex">Display Order</Label>
                <Input
                  id="orderIndex"
                  type="number"
                  value={formData.order_index}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order_index: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-20"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="buttonOutline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const getContentByType = (type: string) =>
    contentItems.filter((item) => item.content_type === type);

  const handleSaveStripe = async () => {
    setIsStripeLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("stripe_configs").upsert({
        user_id: user.id,
        role: "admin",
        stripe_secret_key: stripeSettings.secretKey,
        stripe_publishable_key: stripeSettings.publishableKey,
        is_live_mode: stripeSettings.isLiveMode,
        is_active: stripeSettings.isActive,
      });

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Stripe Settings Saved",
        description:
          "Admin Stripe configuration has been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving Stripe settings:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to save Stripe settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStripeLoading(false);
    }
  };

  const loadStripeSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("stripe_configs")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setStripeSettings({
          secretKey: data.stripe_secret_key || "",
          publishableKey: data.stripe_publishable_key || "",
          isLiveMode: data.is_live_mode || false,
          isActive: data.is_active || true,
        });
      }
    } catch (error) {
      console.error("Error loading Stripe settings:", error);
    }
  };

  // Load Stripe settings on component mount
  useEffect(() => {
    loadStripeSettings();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Settings & Content Management</h1>
          <p className="text-muted-foreground">
            Manage website content and system settings
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Content
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="content">Website Content</TabsTrigger>
          <TabsTrigger value="stripe">Stripe Config</TabsTrigger>
          <TabsTrigger value="seo">SEO Settings</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          {/* Content Type Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {contentTypes.map((type) => {
              const count = getContentByType(type.key).length;
              const published = getContentByType(type.key).filter(
                (item) => item.is_published
              ).length;

              return (
                <Card key={type.key}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <type.icon className="h-8 w-8 text-primary" />
                        <div>
                          <h3 className="font-semibold">{type.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {type.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">
                          {published} published
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Content Management Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                All Content Items
              </CardTitle>
              <CardDescription>
                Manage all website content from one place
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contentItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contentItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const contentType = contentTypes.find(
                                (t) => t.key === item.content_type
                              );
                              const IconComponent = contentType?.icon;
                              return IconComponent ? (
                                <IconComponent className="h-4 w-4" />
                              ) : null;
                            })()}
                            <Badge variant="buttonOutline">
                              {
                                contentTypes.find(
                                  (t) => t.key === item.content_type
                                )?.label
                              }
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.title}</div>
                            {item.slug && (
                              <div className="text-sm text-muted-foreground">
                                /{item.slug}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                item.is_published ? "default" : "secondary"
                              }
                            >
                              {item.is_published ? "Published" : "Draft"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                togglePublishStatus(item.id, !item.is_published)
                              }
                            >
                              {item.is_published ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{item.author || "Admin"}</TableCell>
                        <TableCell>
                          {new Date(item.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="buttonOutline"
                              onClick={() => {
                                setEditingItem(item);
                                setIsCreateDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteContent(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No content items found</p>
                  <Button
                    variant="buttonOutline"
                    className="mt-4"
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    Create Your First Content Item
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stripe">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Admin Stripe Configuration
              </CardTitle>
              <CardDescription>
                Configure admin Stripe settings for platform fees and premium
                features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">
                      Admin Configuration
                    </h4>
                    <p className="text-sm text-blue-700">
                      This Stripe account will receive platform fees from
                      organizers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="adminStripeSecretKey">
                    Stripe Secret Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="adminStripeSecretKey"
                      type="password"
                      value={stripeSettings.secretKey}
                      onChange={(e) =>
                        setStripeSettings((prev) => ({
                          ...prev,
                          secretKey: e.target.value,
                        }))
                      }
                      placeholder="sk_test_... or sk_live_..."
                      className="pr-10"
                    />
                    <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminStripePublishableKey">
                    Stripe Publishable Key
                  </Label>
                  <Input
                    id="adminStripePublishableKey"
                    value={stripeSettings.publishableKey}
                    onChange={(e) =>
                      setStripeSettings((prev) => ({
                        ...prev,
                        publishableKey: e.target.value,
                      }))
                    }
                    placeholder="pk_test_... or pk_live_..."
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Live Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable live payments
                    </p>
                  </div>
                  <Switch
                    checked={stripeSettings.isLiveMode}
                    onCheckedChange={(checked) =>
                      setStripeSettings((prev) => ({
                        ...prev,
                        isLiveMode: checked,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="buttonOutline" asChild>
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Stripe Dashboard
                  </a>
                </Button>
                <Button
                  onClick={handleSaveStripe}
                  disabled={isStripeLoading || !stripeSettings.secretKey}
                >
                  {isStripeLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Save Admin Stripe
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                SEO Settings
              </CardTitle>
              <CardDescription>
                Configure search engine optimization settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="siteTitle">Site Title</Label>
                <Input id="siteTitle" placeholder="Your Website Title" />
              </div>
              <div>
                <Label htmlFor="siteDescription">Site Description</Label>
                <Textarea
                  id="siteDescription"
                  placeholder="Brief description of your website"
                />
              </div>
              <div>
                <Label htmlFor="keywords">Keywords</Label>
                <Input
                  id="keywords"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>
              <div>
                <Label htmlFor="googleAnalytics">Google Analytics ID</Label>
                <Input id="googleAnalytics" placeholder="GA4-XXXXXXXXX" />
              </div>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Save SEO Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  General Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input id="siteName" placeholder="Your Company Name" />
                </div>
                <div>
                  <Label htmlFor="adminEmail">Admin Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@yoursite.com"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <select className="w-full p-2 border rounded-md bg-background z-50 relative">
                    <option>UTC</option>
                    <option>America/New_York</option>
                    <option>Europe/London</option>
                    <option>Asia/Tokyo</option>
                  </select>
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Put site in maintenance mode
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>User Registration</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow new user registrations
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Verification</Label>
                    <p className="text-sm text-muted-foreground">
                      Require email verification
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Update Security
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Content Form Dialog */}
      <ContentFormDialog
        isOpen={isCreateDialogOpen || !!editingItem}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setEditingItem(null);
          resetForm();
        }}
        item={editingItem}
      />
    </div>
  );
}
