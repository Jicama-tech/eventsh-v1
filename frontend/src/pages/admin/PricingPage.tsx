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
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Users,
  UserCheck,
  Store,
  Crown,
  Zap,
  Star,
  Calendar,
  BarChart3,
  Settings,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PricingPlan {
  id: string;
  name: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  features: string[];
  module_access: {
    appointments: boolean;
    prescriptions: boolean;
    reports: boolean;
    ai_assistant: boolean;
    analytics: boolean;
    storefront: boolean;
    crm: boolean;
    events: boolean;
  };
  max_appointments?: number;
  is_active: boolean;
  user_type: "patient" | "organizer";
  is_popular?: boolean;
  created_at: string;
  updated_at: string;
}

const defaultFeatures = {
  patient: [
    "Basic appointment booking",
    "View medical records",
    "Prescription tracking",
    "Basic health analytics",
  ],
  organizer: [
    "Event creation and management",
    "Attendee management",
    "Basic analytics",
    "Email notifications",
  ],
};

const defaultModuleAccess = {
  patient: {
    appointments: true,
    prescriptions: true,
    reports: false,
    ai_assistant: false,
    analytics: false,
    storefront: false,
    crm: false,
    events: false,
  },
  organizer: {
    appointments: false,
    prescriptions: false,
    reports: true,
    ai_assistant: false,
    analytics: true,
    storefront: false,
    crm: false,
    events: true,
  },
};

export function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<PricingPlan>>({
    name: "",
    description: "",
    price_monthly: 0,
    price_yearly: 0,
    features: [],
    module_access: defaultModuleAccess.patient,
    max_appointments: 10,
    is_active: true,
    user_type: "patient",
    is_popular: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPricingPlans();
  }, []);

  const fetchPricingPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Parse JSON fields and ensure proper types
      const parsedData = (data || []).map((plan) => ({
        ...plan,
        user_type: "patient" as const, // Default since it's not in the database schema
        features: Array.isArray(plan.features)
          ? plan.features
          : JSON.parse((plan.features as any) || "[]"),
        module_access:
          typeof plan.module_access === "object"
            ? plan.module_access
            : JSON.parse((plan.module_access as any) || "{}"),
      }));

      setPlans(parsedData as PricingPlan[]);
    } catch (error) {
      console.error("Error fetching pricing plans:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to fetch pricing plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      const { error } = await supabase.from("subscription_plans").insert([
        {
          name: formData.name || "",
          description: formData.description,
          price_monthly: formData.price_monthly,
          price_yearly: formData.price_yearly,
          features: formData.features || [],
          module_access: formData.module_access || {},
          max_appointments: formData.max_appointments,
          is_active: formData.is_active,
        },
      ]);

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Success",
        description: "Pricing plan created successfully",
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchPricingPlans();
    } catch (error) {
      console.error("Error creating plan:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to create pricing plan",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePlan = async (
    planId: string,
    updates: Partial<PricingPlan>
  ) => {
    try {
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Don't stringify if already in correct format
      if (updates.features && Array.isArray(updates.features)) {
        updateData.features = updates.features;
      }
      if (updates.module_access && typeof updates.module_access === "object") {
        updateData.module_access = updates.module_access;
      }

      const { error } = await supabase
        .from("subscription_plans")
        .update(updateData)
        .eq("id", planId);

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Success",
        description: "Pricing plan updated successfully",
      });

      fetchPricingPlans();
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to update pricing plan",
        variant: "destructive",
      });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this pricing plan?")) return;

    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Success",
        description: "Pricing plan deleted successfully",
      });

      fetchPricingPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to delete pricing plan",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price_monthly: 0,
      price_yearly: 0,
      features: [],
      module_access: defaultModuleAccess.patient,
      max_appointments: 10,
      is_active: true,
      user_type: "patient",
      is_popular: false,
    });
    setEditingPlan(null);
  };

  const handleUserTypeChange = (
    userType: "patient" | "organizer"
  ) => {
    setFormData({
      ...formData,
      user_type: userType,
      features: [...defaultFeatures[userType]],
      module_access: { ...defaultModuleAccess[userType] },
    });
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...(formData.features || []), ""],
    });
  };

  const removeFeature = (index: number) => {
    const newFeatures = (formData.features || []).filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  const handleModuleAccessChange = (module: string, value: boolean) => {
    const currentAccess = formData.module_access || defaultModuleAccess.patient;
    setFormData({
      ...formData,
      module_access: {
        ...currentAccess,
        [module]: value,
      } as any,
    });
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case "patient":
        return <Users className="h-4 w-4" />;
      case "organizer":
        return <UserCheck className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case "patient":
        return "bg-blue-100 text-blue-800";
      case "organizer":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const PlanFormDialog = ({
    isOpen,
    onClose,
    plan = null,
  }: {
    isOpen: boolean;
    onClose: () => void;
    plan?: PricingPlan | null;
  }) => {
    const isEditing = !!plan;

    useEffect(() => {
      if (plan) {
        setFormData({
          ...plan,
          features: Array.isArray(plan.features)
            ? plan.features
            : JSON.parse((plan.features as any) || "[]"),
          module_access:
            typeof plan.module_access === "object"
              ? plan.module_access
              : JSON.parse((plan.module_access as any) || "{}"),
        });
      } else {
        resetForm();
      }
    }, [plan]);

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Pricing Plan" : "Create New Pricing Plan"}
            </DialogTitle>
            <DialogDescription>
              Configure pricing plans for different user types with specific
              features and module access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Basic Plan, Premium Plan"
                />
              </div>
              <div>
                <Label htmlFor="userType">User Type *</Label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={formData.user_type}
                  onChange={(e) => handleUserTypeChange(e.target.value as any)}
                >
                  <option value="patient">Patient</option>
                  <option value="organizer">Organizer</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the plan benefits"
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="priceMonthly">Monthly Price ($)</Label>
                <Input
                  id="priceMonthly"
                  type="number"
                  step="0.01"
                  value={formData.price_monthly}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_monthly: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="priceYearly">Yearly Price ($)</Label>
                <Input
                  id="priceYearly"
                  type="number"
                  step="0.01"
                  value={formData.price_yearly}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_yearly: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="maxAppointments">Max Appointments</Label>
                <Input
                  id="maxAppointments"
                  type="number"
                  value={formData.max_appointments}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_appointments: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Settings */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_popular}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_popular: checked })
                  }
                />
                <Label>Popular Plan</Label>
              </div>
            </div>

            <Separator />

            {/* Features */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Plan Features</Label>
                <Button
                  type="button"
                  onClick={addFeature}
                  size="sm"
                  variant="buttonOutline"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Feature
                </Button>
              </div>
              <div className="space-y-2">
                {(formData.features || []).map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={feature}
                      onChange={(e) =>
                        handleFeatureChange(index, e.target.value)
                      }
                      placeholder="Enter feature description"
                    />
                    <Button
                      type="button"
                      onClick={() => removeFeature(index)}
                      size="sm"
                      variant="buttonOutline"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Module Access */}
            <div>
              <Label className="text-base font-semibold mb-3 block">
                Module Access Permissions
              </Label>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(formData.module_access || {}).map(
                  ([module, hasAccess]) => (
                    <div
                      key={module}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        {module === "appointments" && (
                          <Calendar className="h-4 w-4" />
                        )}
                        {module === "prescriptions" && (
                          <Shield className="h-4 w-4" />
                        )}
                        {module === "reports" && (
                          <BarChart3 className="h-4 w-4" />
                        )}
                        {module === "ai_assistant" && (
                          <Zap className="h-4 w-4" />
                        )}
                        {module === "analytics" && (
                          <BarChart3 className="h-4 w-4" />
                        )}
                        {module === "storefront" && (
                          <Store className="h-4 w-4" />
                        )}
                        {module === "crm" && <Users className="h-4 w-4" />}
                        {module === "events" && (
                          <Calendar className="h-4 w-4" />
                        )}
                        <span className="capitalize">
                          {module.replace("_", " ")}
                        </span>
                      </div>
                      <Switch
                        checked={hasAccess as boolean}
                        onCheckedChange={(checked) =>
                          handleModuleAccessChange(module, checked)
                        }
                      />
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="buttonOutline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={
                  isEditing
                    ? () => handleUpdatePlan(plan!.id, formData)
                    : handleCreatePlan
                }
              >
                {isEditing ? "Update Plan" : "Create Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const plansByUserType = plans.reduce((acc, plan) => {
    if (!acc[plan.user_type]) acc[plan.user_type] = [];
    acc[plan.user_type].push(plan);
    return acc;
  }, {} as Record<string, PricingPlan[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground">
            Create and manage subscription plans for different user types
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Plan
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Plans
                </p>
                <p className="text-2xl font-bold">{plans.length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Patient Plans
                </p>
                <p className="text-2xl font-bold">
                  {plansByUserType.patient?.length || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Organizer Plans
                </p>
                <p className="text-2xl font-bold">
                  {plansByUserType.organizer?.length || 0}
                </p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Plans by User Type */}
      <div className="space-y-8">
        {["patient", "organizer"].map((userType) => (
          <Card key={userType}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getUserTypeIcon(userType)}
                {userType.charAt(0).toUpperCase() + userType.slice(1)} Plans
              </CardTitle>
              <CardDescription>
                Pricing plans and features for {userType} users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plansByUserType[userType]?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plansByUserType[userType].map((plan) => (
                    <Card
                      key={plan.id}
                      className={`relative ${
                        plan.is_popular ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {plan.is_popular && (
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground">
                            <Star className="h-3 w-3 mr-1" />
                            Popular
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <Badge
                            variant={plan.is_active ? "default" : "secondary"}
                            className={getUserTypeColor(plan.user_type)}
                          >
                            {plan.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <CardDescription>{plan.description}</CardDescription>
                        <div className="space-y-1">
                          {plan.price_monthly && (
                            <div className="text-2xl font-bold">
                              ${plan.price_monthly}
                              <span className="text-sm font-normal text-muted-foreground">
                                /month
                              </span>
                            </div>
                          )}
                          {plan.price_yearly && (
                            <div className="text-sm text-muted-foreground">
                              ${plan.price_yearly}/year
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Features:</p>
                          <ul className="text-sm space-y-1">
                            {(Array.isArray(plan.features)
                              ? plan.features
                              : JSON.parse((plan.features as any) || "[]")
                            ).map((feature: string, index: number) => (
                              <li key={index} className="flex items-center">
                                <Check className="h-3 w-3 text-green-600 mr-2" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex justify-between pt-4 border-t">
                          <Button
                            size="sm"
                            variant="buttonOutline"
                            onClick={() => {
                              setEditingPlan(plan);
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePlan(plan.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pricing plans found for {userType} users</p>
                  <Button
                    variant="buttonOutline"
                    className="mt-4"
                    onClick={() => {
                      handleUserTypeChange(userType as any);
                      setIsCreateDialogOpen(true);
                    }}
                  >
                    Create First {userType} Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Form Dialog */}
      <PlanFormDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          resetForm();
        }}
        plan={editingPlan}
      />
    </div>
  );
}
