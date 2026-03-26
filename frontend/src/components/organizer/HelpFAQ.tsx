import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  Mic2,
  CreditCard,
  QrCode,
  Settings,
  Globe,
  HelpCircle,
  Ticket,
  LayoutGrid,
} from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  title: string;
  icon: any;
  color: string;
  items: FAQItem[];
}

const faqData: FAQSection[] = [
  {
    title: "Getting Started",
    icon: HelpCircle,
    color: "text-blue-600",
    items: [
      {
        q: "How do I create my first event?",
        a: "Go to the 'Events' tab in the sidebar, click 'Create Event'. Fill in the 7 tabs: Basic Info (title, date, location), Media (banner + gallery), Visitors (ticket types with pricing), Speakers (session spaces + slots), Venue Setup (hall dimensions), Space/AddOns (table templates, add-ons), and Space Layout (drag-and-drop venue designer). Click 'Create Event' when done.",
      },
      {
        q: "How do I publish my event?",
        a: "After creating your event, it will be in 'Draft' status. Go to your event list, click on the event, and change its status to 'Published'. Only published events are visible to the public.",
      },
      {
        q: "How do I set up my Eventfront (public storefront)?",
        a: "Click 'Eventfront' in the sidebar. This opens the storefront customizer where you can set your organization's branding, colors, logo, and contact information. Your public page will be accessible at eventsh.com/your-organization-slug.",
      },
      {
        q: "How do I change my organization's country/currency?",
        a: "Go to Settings → select your country (India or Singapore). The currency symbol (₹ or S$) will update instantly across all pages — no logout needed.",
      },
    ],
  },
  {
    title: "Event Creation",
    icon: Calendar,
    color: "text-purple-600",
    items: [
      {
        q: "What are the 7 tabs in event creation?",
        a: "1) Basic Info — event title, description, dates, location, tags, dress code, age restriction. 2) Media — banner image and up to 5 gallery images. 3) Visitors — define ticket types (VIP, General, etc.) with pricing and feature access. 4) Speakers — create speaker spaces and session slots. 5) Venue Setup — configure hall dimensions and grid. 6) Space/AddOns — create table templates with pricing and add-on items. 7) Space Layout — drag and drop tables and speaker zones onto the venue grid.",
      },
      {
        q: "How do Visitor Types work?",
        a: "Each visitor type (e.g., VIP, Delegate, General) has its own entry price, max count (or unlimited), description, and feature access checkboxes (food, parking, WiFi, etc.). You can also add custom features like 'Lounge' or 'Charging Station'. Visitors select their type when purchasing tickets.",
      },
      {
        q: "What is a Speaker Space vs a Session Slot?",
        a: "A Speaker Space is the physical zone (e.g., Main Stage, Workshop Room) with dimensions that appear on the venue layout. Within each space, you create Session Slots — individual time-bound presentations with speaker details, agenda, timing, contact info, and social media links.",
      },
      {
        q: "How does the 'Is Main Stage' toggle work?",
        a: "When enabled for a Speaker Space, it uses the venue's main stage area with auto-set dimensions. It also appears as the main stage indicator on the venue layout grid. If disabled, you manually set the width and height of the speaker zone.",
      },
      {
        q: "How do I design my venue layout?",
        a: "In the Space Layout tab, you'll see a horizontal strip of all your table templates (blue) and speaker zones (purple). Click any to add it to the venue grid below. Drag to position, click to select, use the rotate button to turn, and the delete button to remove. The grid takes full width for easy designing.",
      },
    ],
  },
  {
    title: "Speaker Management",
    icon: Mic2,
    color: "text-violet-600",
    items: [
      {
        q: "How do speakers apply to speak at my event?",
        a: "On your public event page, there's an 'Apply to Speak' button. Speakers verify their WhatsApp number via OTP, then fill an application form with their name, email, topic, bio, expertise, and social links. No preferred time is asked at application — that comes after approval.",
      },
      {
        q: "What is the speaker request lifecycle?",
        a: "1) Speaker applies → Status: Pending. 2) You approve or reject → WhatsApp notification sent. 3) If approved, speaker selects their time slot (validated against event time and other speakers). 4) If you've set a fee, speaker is redirected to payment page. 5) You confirm payment → QR code + PDF pass generated and sent via WhatsApp. 6) Event day: scan speaker QR for check-in/check-out.",
      },
      {
        q: "How do I add my own speakers (not from applications)?",
        a: "In the event creation form, go to the Speakers tab. Create a Speaker Space, then click 'Add Session' within that space. Fill in the speaker's name, company, agenda, timing, contact details, and social links. These speakers appear in the Speaker Requests management with a 'Generate Pass' button to create their QR code.",
      },
      {
        q: "How do I generate QR passes for organizer-added speakers?",
        a: "Go to Speaker Requests → click 'View Speakers' on the event → find the speaker marked 'Added by you' → click 'Generate Pass'. This creates a QR code + PDF. Then click the download icon to get the PDF.",
      },
      {
        q: "Can I charge speakers a fee for their slot?",
        a: "Yes. When a speaker's request is pending, click the $ icon to set a fee. Toggle 'Charge this speaker' and enter the amount. After approval, the speaker will be redirected to a payment page. You can verify payment and mark it as Paid/Partial from the Speaker Requests management.",
      },
      {
        q: "How does speaker time slot validation work?",
        a: "When an approved speaker selects their time slot: 1) Start time must be after the event start time. 2) End time must be before the event end time. 3) End time must be after start time. 4) The slot cannot overlap with any other speaker's confirmed time slot. Already booked slots are shown in an orange warning box.",
      },
      {
        q: "How do I scan speaker QR codes at the event?",
        a: "Go to your event's QR Scanner page. Select 'Speaker Pass' (purple button). Scan the QR code. Choose 'Check In' for the first scan and 'Check Out' for the second. Speakers receive WhatsApp notifications for both. The check-out requires typing 'CHECK_OUT' to confirm.",
      },
    ],
  },
  {
    title: "Stall / Exhibitor Management",
    icon: LayoutGrid,
    color: "text-green-600",
    items: [
      {
        q: "How do vendors apply for stalls?",
        a: "On the public event page, vendors click 'Rent a Stall', verify their WhatsApp number via OTP, fill in business details (brand name, registration, company logo, product images), and select tables from the venue layout. The request goes to you for approval.",
      },
      {
        q: "What is the stall booking lifecycle?",
        a: "1) Vendor registers → Pending. 2) You confirm → Confirmed. 3) Vendor selects tables + add-ons → Processing. 4) Payment confirmed → Completed (QR + PDF ticket generated). 5) Event day: QR scan for check-in/check-out. 6) Post-event: return deposit.",
      },
      {
        q: "How do I manage stall payments?",
        a: "In the vendor requests table, click the credit card icon for stalls with 'Processing' or 'Confirmed' status. Choose 'Partial Payment' or 'Fully Paid'. When marked as Paid, a stall ticket with QR code is automatically generated and sent to the vendor via WhatsApp.",
      },
    ],
  },
  {
    title: "Tickets & Attendees",
    icon: Ticket,
    color: "text-orange-600",
    items: [
      {
        q: "How do visitors buy tickets?",
        a: "Visitors go to your public event page or Eventfront, select their visitor type, fill in details, and proceed to payment. After payment, they receive a ticket with QR code via WhatsApp.",
      },
      {
        q: "How do I track attendance?",
        a: "Go to the Attendees tab in your dashboard. You can see all events with their attendance counts. Click 'View' on any event to see detailed attendee lists with check-in/check-out times.",
      },
      {
        q: "How does the QR scanner work?",
        a: "Navigate to your event's scan page. Three modes are available: Visitor Ticket (blue), Exhibitor Ticket (green), and Speaker Pass (purple). Select a mode, point the camera at the QR code, and the system validates and marks attendance automatically. WhatsApp notifications are sent on check-in/check-out.",
      },
    ],
  },
  {
    title: "Payments & Currency",
    icon: CreditCard,
    color: "text-emerald-600",
    items: [
      {
        q: "How do I set up my payment QR code?",
        a: "Go to Settings → upload your payment QR code image. For Indian organizers, you can enable Dynamic UPI QR which generates amount-specific UPI deep links. For Singapore, PayNow QR is supported.",
      },
      {
        q: "How does currency work?",
        a: "Your country setting determines the currency symbol. India → ₹ (INR), Singapore → S$ (SGD). Change it in Settings — the currency updates instantly across all pages without logout.",
      },
      {
        q: "How are speaker/stall payments processed?",
        a: "EventSH doesn't process payments directly. Your payment QR code is shown to the speaker/vendor. They scan and pay via their preferred method. They click 'I've Completed Payment'. You verify in your bank/UPI app, then mark as 'Paid' in the dashboard. This triggers QR pass generation.",
      },
    ],
  },
  {
    title: "QR Codes & Scanning",
    icon: QrCode,
    color: "text-cyan-600",
    items: [
      {
        q: "What types of QR codes does EventSH generate?",
        a: "Three types: 1) Visitor Ticket QR — for event entry. 2) Exhibitor/Stall QR — for vendor check-in/check-out. 3) Speaker Pass QR — for speaker check-in/check-out. Each has a unique type identifier that prevents cross-scanning.",
      },
      {
        q: "Can normal QR scanners read EventSH QR codes?",
        a: "No. EventSH QR codes contain encrypted JSON payloads with a warning message. They can ONLY be scanned using the EventSH QR Scanner within the organizer's event page. This is a security feature to prevent unauthorized scanning.",
      },
      {
        q: "What happens when I scan a QR code?",
        a: "First scan = Check-In (records time, sends WhatsApp). Second scan = Check-Out (records time, calculates duration, sends WhatsApp). The scanner validates: correct event, not already checked in/out, valid QR type.",
      },
    ],
  },
  {
    title: "Settings & Customization",
    icon: Settings,
    color: "text-gray-600",
    items: [
      {
        q: "What can I configure in Settings?",
        a: "Organization profile (name, email, phone, address), country/currency, business registration (GST/UEN), payment QR code, WhatsApp QR, Instagram QR, receipt type, tax percentage, discount percentage, terms & conditions, operators management, and coupon codes.",
      },
      {
        q: "How do I create coupon codes?",
        a: "In Settings → Coupons section. Create a code with discount type (percentage or flat), amount, minimum order, max usage, expiry date, and which event it applies to. Coupons can be applied during stall booking payments.",
      },
      {
        q: "How do I add operators?",
        a: "In Settings → Operators section. Add operator name and WhatsApp number. Operators can assist with event management tasks.",
      },
    ],
  },
  {
    title: "Eventfront (Public Page)",
    icon: Globe,
    color: "text-indigo-600",
    items: [
      {
        q: "What is Eventfront?",
        a: "Eventfront is your public-facing page where visitors can discover your events, buy tickets, apply as speakers, and book stalls. It's accessible at eventsh.com/your-organization-slug.",
      },
      {
        q: "How do I customize my Eventfront?",
        a: "Click 'Eventfront' in the sidebar. You can customize colors, logo, banner, contact information, and social media links. Preview changes before publishing.",
      },
      {
        q: "What do visitors see on my event page?",
        a: "Event details (title, description, dates, location), gallery images, features, speaker lineup (if any), organizer contact info, 'Apply to Speak' button, 'Rent a Stall' button, and ticket purchase options.",
      },
    ],
  },
];

export function HelpFAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>("Getting Started");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const filteredSections = faqData
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !searchQuery.trim() ||
          item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.a.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  const totalQuestions = faqData.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <HelpCircle className="h-12 w-12 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Help Center</h2>
        <p className="text-muted-foreground">
          Everything you need to know about managing your events
        </p>
        <Badge variant="outline">{totalQuestions} articles</Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-lg mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search FAQs... (e.g. 'speaker', 'payment', 'QR code')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* FAQ Sections */}
      <div className="space-y-4 max-w-4xl mx-auto">
        {filteredSections.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No results found for "{searchQuery}"</p>
            <p className="text-sm mt-1">Try different keywords</p>
          </div>
        )}

        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.title;

          return (
            <Card key={section.title}>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedSection(isExpanded ? null : section.title)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${section.color}`} />
                    {section.title}
                    <Badge variant="secondary" className="text-[10px]">
                      {section.items.length}
                    </Badge>
                  </CardTitle>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-2">
                  {section.items.map((item, idx) => {
                    const itemKey = `${section.title}-${idx}`;
                    const isItemExpanded = expandedItem === itemKey;

                    return (
                      <div
                        key={idx}
                        className="border rounded-lg overflow-hidden"
                      >
                        <button
                          className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-start justify-between gap-3"
                          onClick={() => setExpandedItem(isItemExpanded ? null : itemKey)}
                        >
                          <span className="font-medium text-sm">{item.q}</span>
                          {isItemExpanded ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                          )}
                        </button>
                        {isItemExpanded && (
                          <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed bg-gray-50/50">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
