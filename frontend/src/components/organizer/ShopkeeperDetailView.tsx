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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Store,
  Mail,
  Phone,
  MapPin,
  Globe,
  Users,
  DollarSign,
  Package,
  Calendar,
  Edit,
  Trash2,
  AlertTriangle,
  MessageCircle,
  Instagram,
  Percent,
  CreditCard,
  FileText,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ShopkeeperDetailViewProps {
  shopkeeper: any;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (shopkeeper: any) => void;
  onDelete: (shopkeeperId: string) => void;
}

export function ShopkeeperDetailView({
  shopkeeper,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: ShopkeeperDetailViewProps) {
  if (!shopkeeper) return null;

  const handleEdit = () => {
    onEdit(shopkeeper);
    onClose();
  };

  const handleDelete = () => {
    onDelete(shopkeeper.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Store className="h-6 w-6 text-primary" />
                {shopkeeper.shopName}
              </DialogTitle>
              <DialogDescription className="text-base font-medium text-muted-foreground">
                Owned by {shopkeeper.name}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={shopkeeper.approved ? "default" : "destructive"}>
                {shopkeeper.approved ? "Approved" : "Pending"}
              </Badge>
              <Badge variant="outline" className="bg-primary/5">
                {shopkeeper.businessCategory}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Contact & Socials */}
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Contact & Socials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-blue-500" />
                <a
                  href={`mailto:${shopkeeper.businessEmail}`}
                  className="text-sm hover:underline font-medium"
                >
                  {shopkeeper.businessEmail}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-green-600" />
                <a
                  href={`tel:${shopkeeper.phone}`}
                  className="text-sm hover:underline font-medium"
                >
                  {shopkeeper.phone}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-green-500" />
                <a
                  href={`https://wa.me/${shopkeeper.whatsappNumber.replace(/\+/g, "")}`}
                  target="_blank"
                  className="text-sm hover:underline font-medium"
                >
                  WhatsApp: {shopkeeper.whatsappNumber}
                </a>
              </div>
              {shopkeeper.instagramHandle && (
                <div className="flex items-center gap-3">
                  <Instagram className="h-4 w-4 text-pink-500" />
                  <a
                    href={shopkeeper.instagramHandle}
                    target="_blank"
                    className="text-sm hover:underline font-medium"
                  >
                    Instagram Profile
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Identification */}
          <Card className="border-t-4 border-t-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Registration Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  GST Number:
                </span>
                <Badge variant="secondary" className="font-mono">
                  {shopkeeper.GSTNumber || "N/A"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  UEN Number:
                </span>
                <span className="text-sm font-medium">
                  {shopkeeper.UENNumber || "Not Provided"}
                </span>
              </div>
              <div className="flex items-start gap-2 pt-2">
                <MapPin className="h-4 w-4 text-red-500 mt-1" />
                <span className="text-sm leading-relaxed">
                  {shopkeeper.address}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Financials & Commission */}
          <Card className="md:col-span-2 bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center border-r">
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                    <Percent className="h-3 w-3" /> Commission
                  </div>
                  <div className="text-xl font-bold">
                    {shopkeeper.commissionPercentage}%
                  </div>
                </div>
                <div className="text-center border-r">
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                    <CreditCard className="h-3 w-3" /> Tax Rate
                  </div>
                  <div className="text-xl font-bold">
                    {shopkeeper.taxPercentage}%
                  </div>
                </div>
                <div className="text-center border-r">
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                    <Percent className="h-3 w-3" /> Discount
                  </div>
                  <div className="text-xl font-bold">
                    {shopkeeper.discountPercentage}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">
                    Receipt Type
                  </div>
                  <div className="text-xl font-bold">
                    {shopkeeper.receiptType}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms and Conditions (HTML) */}
          {shopkeeper.termsAndConditions && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Terms & Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-sm text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: shopkeeper.termsAndConditions,
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
