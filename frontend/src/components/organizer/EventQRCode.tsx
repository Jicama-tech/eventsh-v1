// EventQRCode.tsx
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Download,
  Share2,
  Copy,
  X,
  Eye,
  Calendar,
  MapPin,
  Ticket,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";

interface EventQRCodeProps {
  event: {
    id: string | number;
    name: string;
    date: string;
    time?: string;
    location: string;
    category: string;
    ticketPrice?: string;
    organizationName: string; // Added organization name
  };
  apiURL: string; // Added API URL
  onClose: () => void;
}

export function EventQRCode({ event, apiURL, onClose }: EventQRCodeProps) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>("");
  const [qrSize, setQrSize] = useState(256);
  const [copied, setCopied] = useState(false);
  const [slug, setSlug] = useState("");
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  useEffect(() => {
    async function fetchData() {
      try {
        if (event.organizationName) {
          const response = await fetch(
            `${apiURL}/organizers/profile-get/${event.organizationName}`,
            {
              method: "GET",
            }
          );

          if (!response.ok) {
            console.error("Failed to fetch organizer slug:", response.status);
            return;
          }

          const data = await response.json();
          setSlug(data.data.slug);
        }
      } catch (error) {
        console.error("Error fetching organizer slug:", error);
      }
    }
    fetchData();
  }, [event.organizationName, apiURL]);

  // Construct the event URL in the required format
  const eventURL = `https://eventsh.com/organizers/${slug}/events/${event.id}`;

  const eventData = {
    eventId: event.id,
    eventName: event.name,
    date: event.date,
    time: event.time,
    location: event.location,
    category: event.category,
    url: eventURL,
    joinType: "qr_scan",
  };

  const qrData = JSON.stringify(eventData);

  useEffect(() => {
    generateQRCode();
  }, [qrSize, qrData]);

  const generateQRCode = async () => {
    try {
      const dataURL = await QRCodeLib.toDataURL(qrData, {
        width: qrSize,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      });
      setQrCodeDataURL(dataURL);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const downloadQRCode = () => {
    const link = document.createElement("a");
    link.download = `${event.name.replace(/[^a-z0-9]/gi, "_")}_QR_Code.png`;
    link.href = qrCodeDataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyEventURL = async () => {
    try {
      await navigator.clipboard.writeText(eventURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
    }
  };

  const shareEvent = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.name,
          text: `Join me at ${event.name}! Scan the QR code or use this link to get your ticket.`,
          url: eventURL,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      copyEventURL();
    }
  };

  const printQRCode = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Event QR Code - ${event.name}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px;
                background: white;
              }
              .qr-container {
                display: inline-block;
                border: 2px solid #000;
                padding: 20px;
                margin: 20px 0;
                background: white;
              }
              .event-info {
                margin: 20px 0;
                text-align: left;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
              }
              .event-title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
                color: #000;
              }
              .event-detail {
                margin: 5px 0;
                color: #333;
              }
              .instructions {
                font-size: 14px;
                color: #666;
                margin-top: 20px;
                font-style: italic;
              }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            <div class="event-title">${event.name}</div>
            <div class="qr-container">
              <img src="${qrCodeDataURL}" alt="Event QR Code" style="display: block;" />
            </div>
            <div class="event-info">
              <div class="event-detail"><strong>Date:</strong> ${event.date}${
        event.time ? ` at ${event.time}` : ""
      }</div>
              <div class="event-detail"><strong>Location:</strong> ${
                event.location
              }</div>
              <div class="event-detail"><strong>Category:</strong> ${
                event.category
              }</div>
              ${
                event.ticketPrice
                  ? `<div class="event-detail"><strong>Price:</strong> ${formatPrice(Number(event.ticketPrice))}</div>`
                  : ""
              }
            </div>
            <div class="instructions">
              Scan this QR code with your phone camera to join the event or visit:<br/>
              ${eventURL}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <QrCode className="h-5 w-5" />
                <span>Event QR Code</span>
              </CardTitle>
              <CardDescription>
                Share this QR code for instant event access
              </CardDescription>
            </div>
            <Button variant="buttonOutline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Event Information */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{event.name}</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {event.date}
                        {event.time ? ` at ${event.time}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span>{event.location}</span>
                    </div>
                    {event.ticketPrice && (
                      <div className="flex items-center space-x-1">
                        <Ticket className="h-3 w-3" />
                        <span>{formatPrice(Number(event.ticketPrice))}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="outline">{event.category}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Display */}
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-dashed border-border">
              {qrCodeDataURL && (
                <img
                  src={qrCodeDataURL}
                  alt="Event QR Code"
                  className="mx-auto"
                  style={{ width: qrSize, height: qrSize }}
                />
              )}
            </div>

            {/* QR Code Size Controls */}
            <div className="flex items-center space-x-4">
              <span className="text-sm">Size:</span>
              {[128, 256, 512].map((size) => (
                <Button
                  key={size}
                  variant={qrSize === size ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQrSize(size)}
                >
                  {size}px
                </Button>
              ))}
            </div>

            {/* Event URL and copy */}
            <div className="w-full">
              <div className="flex items-center space-x-2">
                <div className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {eventURL}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyEventURL}
                  className="shrink-0"
                >
                  {copied ? "Copied!" : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              onClick={downloadQRCode}
              className="flex items-center space-x-2"
              variant="default"
            >
              <Download className="h-4 w-4" />
              <span>Download QR Code</span>
            </Button>
            <Button
              variant="outline"
              onClick={shareEvent}
              className="flex items-center space-x-2"
            >
              <Share2 className="h-4 w-4" />
              <span>Share Event</span>
            </Button>
            <Button
              variant="outline"
              onClick={printQRCode}
              className="flex items-center space-x-2"
            >
              <span>🖨️</span>
              <span>Print</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(eventURL, "_blank")}
              className="flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </Button>
          </div>

          {/* Usage Instructions */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold mb-2">How to use this QR Code:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Users can scan this QR code with their phone camera</li>
                <li>• It will direct them to the event registration page</li>
                <li>• They can purchase tickets or register for free events</li>
                <li>• Perfect for flyers, posters, and social media posts</li>
                <li>• Track attendance by scanning at event entrance</li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
