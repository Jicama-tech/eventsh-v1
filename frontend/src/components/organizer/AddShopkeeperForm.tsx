import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Store, X } from "lucide-react";
import { t } from "@/i18n/t";

interface AddShopkeeperFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (shopkeeperData: any) => void;
  editingShopkeeper?: any;
}

export function AddShopkeeperForm({
  isOpen,
  onClose,
  onSubmit,
  editingShopkeeper,
}: AddShopkeeperFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    shopName: editingShopkeeper?.name || "",
    email: editingShopkeeper?.email || "",
    phone: editingShopkeeper?.phone || "",
    category: editingShopkeeper?.category || "",
    description: editingShopkeeper?.description || "",
    address: editingShopkeeper?.address || "",
    contactPerson: editingShopkeeper?.contactPerson || "",
    website: editingShopkeeper?.website || "",
    socialMedia: editingShopkeeper?.socialMedia || "",
    businessLicense: editingShopkeeper?.businessLicense || "",
    taxId: editingShopkeeper?.taxId || "",
    bankAccount: editingShopkeeper?.bankAccount || "",
    notes: editingShopkeeper?.notes || "",
  });

  const categories = [
    "Electronics",
    "Food & Beverage",
    "Fashion & Clothing",
    "Arts & Crafts",
    "Home & Garden",
    "Health & Beauty",
    "Sports & Recreation",
    "Books & Education",
    "Toys & Games",
    "Services",
    "Other",
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.shopName ||
      !formData.email ||
      !formData.phone ||
      !formData.category
    ) {
      toast({
        duration: 5000,
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData);

    // Reset form
    setFormData({
      shopName: "",
      email: "",
      phone: "",
      category: "",
      description: "",
      address: "",
      contactPerson: "",
      website: "",
      socialMedia: "",
      businessLicense: "",
      taxId: "",
      bankAccount: "",
      notes: "",
    });

    toast({
      duration: 5000,
      title: editingShopkeeper ? "Shopkeeper Updated" : "Shopkeeper Added",
      description: editingShopkeeper
        ? "Shopkeeper information has been updated successfully."
        : "New shopkeeper has been added successfully.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {editingShopkeeper ? "Edit Shopkeeper" : "Add New Shopkeeper"}
          </DialogTitle>
          <DialogDescription>
            {editingShopkeeper
              ? "Update the shopkeeper's information below."
              : "Fill in the details to add a new shopkeeper to your events."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("Basic Information")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shopName">{t("Shop Name *")}</Label>
                  <Input
                    id="shopName"
                    value={formData.shopName}
                    onChange={(e) =>
                      handleInputChange("shopName", e.target.value)
                    }
                    placeholder={t("Enter shop name")}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contactPerson">{t("Contact Person")}</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      handleInputChange("contactPerson", e.target.value)
                    }
                    placeholder={t("Owner/Manager name")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">{t("Email *")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="shop@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t("Phone *")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+1-555-0123"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="category">{t("Category *")}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    handleInputChange("category", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select business category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">{t("Business Description")}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder={t("Brief description of products/services")}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="address">{t("Business Address")}</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder={t("Complete business address")}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Online Presence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("Online Presence")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="website">{t("Website")}</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  placeholder="https://www.shopname.com"
                />
              </div>

              <div>
                <Label htmlFor="socialMedia">{t("Social Media")}</Label>
                <Input
                  id="socialMedia"
                  value={formData.socialMedia}
                  onChange={(e) =>
                    handleInputChange("socialMedia", e.target.value)
                  }
                  placeholder={t("Instagram, Facebook, etc.")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("Business Details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessLicense">{t("Business License Number")}</Label>
                  <Input
                    id="businessLicense"
                    value={formData.businessLicense}
                    onChange={(e) =>
                      handleInputChange("businessLicense", e.target.value)
                    }
                    placeholder={t("License number")}
                  />
                </div>
                <div>
                  <Label htmlFor="taxId">{t("Tax ID")}</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => handleInputChange("taxId", e.target.value)}
                    placeholder={t("Tax identification number")}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bankAccount">{t("Bank Account Details")}</Label>
                <Input
                  id="bankAccount"
                  value={formData.bankAccount}
                  onChange={(e) =>
                    handleInputChange("bankAccount", e.target.value)
                  }
                  placeholder={t("Account details for payments")}
                />
              </div>

              <div>
                <Label htmlFor="notes">{t("Additional Notes")}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder={t("Any additional information or special requirements")}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="buttonOutline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {editingShopkeeper ? "Update Shopkeeper" : "Add Shopkeeper"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
