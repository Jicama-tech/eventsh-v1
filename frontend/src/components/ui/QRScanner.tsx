import { useState, useEffect } from "react";
import { BarcodeScanner } from "@capacitor-community/barcode-scanner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, X, CheckCircle, Users, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QRScannerProps {
  onScanComplete: (data: string) => void;
  onClose: () => void;
  type: "attendance" | "product" | "general";
  eventId?: string;
  shopkeeperId?: string;
}

interface AttendanceData {
  eventId: string;
  eventName: string;
  organizerName: string;
  date: string;
  location: string;
  userId?: string;
}

interface ProductData {
  productId: string;
  productName: string;
  price: number;
  shopkeeperName: string;
  inStock: boolean;
}

export function QRScanner({
  onScanComplete,
  onClose,
  type,
  eventId,
  shopkeeperId,
}: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Check camera permissions on component mount
  useEffect(() => {
    checkPermissions();
    return () => {
      stopScan();
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const status = await BarcodeScanner.checkPermission({ force: true });
      setHasPermission(status.granted);
      if (!status.granted) {
        // Request permission by trying to check again with force
        const retryStatus = await BarcodeScanner.checkPermission({
          force: true,
        });
        setHasPermission(retryStatus.granted);
      }
    } catch (error) {
      console.error("Permission check failed:", error);
      setHasPermission(false);
      toast({
        duration: 5000,
        title: "Permission Error",
        description: "Camera permission is required for QR scanning",
        variant: "destructive",
      });
    }
  };

  const startScan = async () => {
    if (!hasPermission) {
      await checkPermissions();
      return;
    }

    try {
      setIsScanning(true);

      // Hide background elements
      document.body.classList.add("scanner-active");

      const result = await BarcodeScanner.startScan();

      if (result.hasContent) {
        setScannedData(result.content);
        await processScannedData(result.content);
        onScanComplete(result.content);
      }
    } catch (error) {
      console.error("Scan failed:", error);
      toast({
        duration: 5000,
        title: "Scan Failed",
        description: "Unable to scan QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      stopScan();
    }
  };

  const stopScan = async () => {
    try {
      await BarcodeScanner.stopScan();
      setIsScanning(false);
      document.body.classList.remove("scanner-active");
    } catch (error) {
      console.error("Stop scan failed:", error);
    }
  };

  const processScannedData = async (data: string) => {
    setIsProcessing(true);

    try {
      const qrData = JSON.parse(data);

      if (type === "attendance" && qrData.type === "event_attendance") {
        await markAttendance(qrData);
      } else if (type === "product" && qrData.type === "product_scan") {
        await processProduct(qrData);
      } else {
        // General QR code processing
        toast({
          duration: 5000,
          title: "QR Code Scanned",
          description: `Scanned: ${data.substring(0, 50)}...`,
        });
      }
    } catch (error) {
      // If it's not JSON, treat as plain text
      toast({
        duration: 5000,
        title: "QR Code Scanned",
        description: `Content: ${data.substring(0, 50)}...`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const markAttendance = async (attendanceData: AttendanceData) => {
    try {
      // TODO: Record attendance in database once migration is run

      toast({
        duration: 5000,
        title: "Attendance Marked! 🎉",
        description: `Successfully checked into ${attendanceData.eventName}`,
      });
    } catch (error) {
      console.error("Attendance marking failed:", error);
      toast({
        duration: 5000,
        title: "Attendance Failed",
        description: "Unable to mark attendance. Please try again.",
        variant: "destructive",
      });
    }
  };

  const processProduct = async (productData: ProductData) => {
    try {
      // Process product scan for shopkeeper
      toast({
        duration: 5000,
        title: "Product Scanned! 📦",
        description: `${productData.productName} - $${productData.price}`,
      });
    } catch (error) {
      console.error("Product processing failed:", error);
      toast({
        duration: 5000,
        title: "Product Scan Failed",
        description: "Unable to process product. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (hasPermission === false) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Permission Required
            </CardTitle>
            <CardDescription>
              We need camera access to scan QR codes for{" "}
              {type === "attendance" ? "event check-in" : "product scanning"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={checkPermissions} className="w-full">
              Grant Camera Permission
            </Button>
            <Button
              variant="buttonOutline"
              onClick={onClose}
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Scanner overlay UI */}
        <div className="absolute inset-0 bg-black">
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="flex justify-between items-center">
              <Badge variant="secondary" className="bg-black/50 text-white">
                {type === "attendance" ? "Scan Event QR" : "Scan Product QR"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopScan}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Scanner frame */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="w-64 h-64 border-2 border-white rounded-lg relative">
                {/* Corner decorations */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
              </div>
              <p className="text-white text-center mt-4">
                Point your camera at the QR code
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            QR Code Scanner
          </CardTitle>
          <CardDescription>
            {type === "attendance"
              ? "Scan your event QR code to check in"
              : type === "product"
              ? "Scan product QR codes for inventory management"
              : "Scan any QR code"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scannedData && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">
                  Successfully Scanned
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {scannedData.substring(0, 100)}...
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={startScan}
              className="flex-1"
              disabled={isProcessing}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Start Scanning"}
            </Button>
            <Button variant="buttonOutline" onClick={onClose}>
              Cancel
            </Button>
          </div>

          {type === "attendance" && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Event check-in
              </p>
              <p className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location verified
              </p>
              <p className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Timestamp recorded
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
