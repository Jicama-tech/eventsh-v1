import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Store, User, FileText, CreditCard } from "lucide-react";

interface ShopkeeperRequestFormProps {
  onClose: () => void;
  onSubmit: (requestData: any) => void;
  events: Array<{ id: number; name: string; date: string; category: string }>;
}

export function ShopkeeperRequestForm({
  onClose,
  onSubmit,
  events,
}: ShopkeeperRequestFormProps) {
  const [formData, setFormData] = useState({
    // Business Information
    businessName: "",
    businessType: "",
    businessCategory: "",
    businessDescription: "",
    establishedYear: "",
    registrationNumber: "",
    taxId: "",

    // Contact Information
    ownerName: "",
    email: "",
    phone: "",
    alternatePhone: "",
    website: "",

    // Address Information
    businessAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",

    // Event Participation
    selectedEvents: [],
    boothRequirements: "",
    spaceRequired: "",
    electricityNeeded: false,
    wifiNeeded: false,
    storageNeeded: false,

    // Products/Services
    productCategories: [],
    productDescription: "",
    priceRange: "",
    specialOffers: "",
    sampleProducts: [],

    // Business Documents
    businessLicense: null,
    insuranceCertificate: null,
    productCatalog: null,
    previousEventPhotos: [],

    // Experience
    yearsInBusiness: "",
    previousEvents: "",
    references: "",
    specialSkills: "",

    // Financial Information
    expectedRevenue: "",
    paymentMethods: [],
    bankDetails: {
      accountName: "",
      accountNumber: "",
      bankName: "",
      routingNumber: "",
    },

    // Additional Information
    socialMedia: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
    specialRequests: "",
    marketingPermission: false,
    dataProcessingConsent: false,
    termsAccepted: false,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [currentCategory, setCurrentCategory] = useState("");

  const addProductCategory = () => {
    if (
      currentCategory.trim() &&
      !formData.productCategories.includes(currentCategory.trim())
    ) {
      setFormData({
        ...formData,
        productCategories: [
          ...formData.productCategories,
          currentCategory.trim(),
        ],
      });
      setCurrentCategory("");
    }
  };

  const removeProductCategory = (categoryToRemove: string) => {
    setFormData({
      ...formData,
      productCategories: formData.productCategories.filter(
        (cat) => cat !== categoryToRemove
      ),
    });
  };

  const handleEventSelection = (eventId: number, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        selectedEvents: [...formData.selectedEvents, eventId],
      });
    } else {
      setFormData({
        ...formData,
        selectedEvents: formData.selectedEvents.filter((id) => id !== eventId),
      });
    }
  };

  const handlePaymentMethodChange = (method: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        paymentMethods: [...formData.paymentMethods, method],
      });
    } else {
      setFormData({
        ...formData,
        paymentMethods: formData.paymentMethods.filter((m) => m !== method),
      });
    }
  };

  const handleFileUpload = (
    field: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({
        ...formData,
        [field]: file,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const steps = [
    { number: 1, title: "Business Info", icon: Store },
    { number: 2, title: "Contact & Address", icon: User },
    { number: 3, title: "Event Participation", icon: FileText },
    { number: 4, title: "Products & Services", icon: Store },
    { number: 5, title: "Documents & Financial", icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Shopkeeper Registration Request</CardTitle>
              <CardDescription>
                Apply to participate as a vendor in our events
              </CardDescription>
            </div>
            <Button variant="buttonOutline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Step Navigation */}
          <div className="flex space-x-2 mt-4 overflow-x-auto">
            {steps.map((step) => (
              <Button
                key={step.number}
                variant={currentStep === step.number ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentStep(step.number)}
                className="flex items-center space-x-1 whitespace-nowrap"
              >
                <step.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.number}</span>
              </Button>
            ))}
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Step 1: Business Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessName: e.target.value,
                        })
                      }
                      placeholder="Enter your business name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessType">Business Type *</Label>
                    <Select
                      onValueChange={(value) =>
                        setFormData({ ...formData, businessType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select business type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sole-proprietorship">
                          Sole Proprietorship
                        </SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                        <SelectItem value="llc">LLC</SelectItem>
                        <SelectItem value="corporation">Corporation</SelectItem>
                        <SelectItem value="nonprofit">Nonprofit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="businessCategory">Business Category *</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData({ ...formData, businessCategory: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your business category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food-beverage">
                        Food & Beverage
                      </SelectItem>
                      <SelectItem value="clothing-fashion">
                        Clothing & Fashion
                      </SelectItem>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="arts-crafts">Arts & Crafts</SelectItem>
                      <SelectItem value="books-media">Books & Media</SelectItem>
                      <SelectItem value="health-beauty">
                        Health & Beauty
                      </SelectItem>
                      <SelectItem value="home-garden">Home & Garden</SelectItem>
                      <SelectItem value="sports-recreation">
                        Sports & Recreation
                      </SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="businessDescription">
                    Business Description *
                  </Label>
                  <Textarea
                    id="businessDescription"
                    value={formData.businessDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessDescription: e.target.value,
                      })
                    }
                    placeholder="Describe your business, products, and services..."
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="establishedYear">Established Year</Label>
                    <Input
                      id="establishedYear"
                      type="number"
                      value={formData.establishedYear}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          establishedYear: e.target.value,
                        })
                      }
                      placeholder="2020"
                      min="1900"
                      max={new Date().getFullYear()}
                    />
                  </div>
                  <div>
                    <Label htmlFor="registrationNumber">
                      Registration Number
                    </Label>
                    <Input
                      id="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          registrationNumber: e.target.value,
                        })
                      }
                      placeholder="Business registration #"
                    />
                  </div>
                  <div>
                    <Label htmlFor="taxId">Tax ID / EIN</Label>
                    <Input
                      id="taxId"
                      value={formData.taxId}
                      onChange={(e) =>
                        setFormData({ ...formData, taxId: e.target.value })
                      }
                      placeholder="Tax identification number"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Contact & Address */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ownerName">Owner/Contact Person *</Label>
                    <Input
                      id="ownerName"
                      value={formData.ownerName}
                      onChange={(e) =>
                        setFormData({ ...formData, ownerName: e.target.value })
                      }
                      placeholder="Full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="contact@business.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="phone">Primary Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+1-555-0123"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="alternatePhone">Alternate Phone</Label>
                    <Input
                      id="alternatePhone"
                      value={formData.alternatePhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          alternatePhone: e.target.value,
                        })
                      }
                      placeholder="+1-555-0124"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) =>
                        setFormData({ ...formData, website: e.target.value })
                      }
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="businessAddress">Business Address *</Label>
                  <Input
                    id="businessAddress"
                    value={formData.businessAddress}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessAddress: e.target.value,
                      })
                    }
                    placeholder="Street address"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="City"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State/Province *</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      placeholder="State"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">ZIP/Postal Code *</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) =>
                        setFormData({ ...formData, zipCode: e.target.value })
                      }
                      placeholder="12345"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                      placeholder="Country"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Event Participation */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Select Events to Participate *</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2 max-h-48 overflow-y-auto border rounded-md p-4">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`event-${event.id}`}
                          checked={formData.selectedEvents.includes(event.id)}
                          onCheckedChange={(checked) =>
                            handleEventSelection(event.id, checked as boolean)
                          }
                        />
                        <Label htmlFor={`event-${event.id}`} className="flex-1">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{event.name}</span>
                            <div className="flex space-x-2">
                              <Badge variant="buttonOutline">
                                {event.category}
                              </Badge>
                              <Badge variant="secondary">{event.date}</Badge>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="spaceRequired">
                      Space Required (sq ft)
                    </Label>
                    <Input
                      id="spaceRequired"
                      type="number"
                      value={formData.spaceRequired}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          spaceRequired: e.target.value,
                        })
                      }
                      placeholder="100"
                      min="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="expectedRevenue">
                      Expected Revenue per Event
                    </Label>
                    <Input
                      id="expectedRevenue"
                      value={formData.expectedRevenue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          expectedRevenue: e.target.value,
                        })
                      }
                      placeholder="$1,000 - $5,000"
                    />
                  </div>
                </div>

                <div>
                  <Label>Booth Requirements</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="electricity"
                        checked={formData.electricityNeeded}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            electricityNeeded: checked as boolean,
                          })
                        }
                      />
                      <Label htmlFor="electricity">Electricity</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="wifi"
                        checked={formData.wifiNeeded}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            wifiNeeded: checked as boolean,
                          })
                        }
                      />
                      <Label htmlFor="wifi">WiFi Access</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="storage"
                        checked={formData.storageNeeded}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            storageNeeded: checked as boolean,
                          })
                        }
                      />
                      <Label htmlFor="storage">Storage Space</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="boothRequirements">
                    Additional Booth Requirements
                  </Label>
                  <Textarea
                    id="boothRequirements"
                    value={formData.boothRequirements}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        boothRequirements: e.target.value,
                      })
                    }
                    placeholder="Describe any special requirements for your booth setup..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 4: Products & Services */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="productCategories">Product Categories</Label>
                  <div className="flex space-x-2 mb-2">
                    <Input
                      value={currentCategory}
                      onChange={(e) => setCurrentCategory(e.target.value)}
                      placeholder="Add product category"
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addProductCategory())
                      }
                    />
                    <Button
                      type="button"
                      onClick={addProductCategory}
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.productCategories.map((category, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center space-x-1"
                      >
                        <span>{category}</span>
                        <button
                          type="button"
                          onClick={() => removeProductCategory(category)}
                          className="ml-1 text-xs"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="productDescription">
                    Product/Service Description *
                  </Label>
                  <Textarea
                    id="productDescription"
                    value={formData.productDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        productDescription: e.target.value,
                      })
                    }
                    placeholder="Describe the products or services you'll offer..."
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priceRange">Price Range</Label>
                    <Input
                      id="priceRange"
                      value={formData.priceRange}
                      onChange={(e) =>
                        setFormData({ ...formData, priceRange: e.target.value })
                      }
                      placeholder="$5 - $100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="yearsInBusiness">Years in Business</Label>
                    <Input
                      id="yearsInBusiness"
                      type="number"
                      value={formData.yearsInBusiness}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          yearsInBusiness: e.target.value,
                        })
                      }
                      placeholder="5"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="specialOffers">
                    Special Offers for Event
                  </Label>
                  <Textarea
                    id="specialOffers"
                    value={formData.specialOffers}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialOffers: e.target.value,
                      })
                    }
                    placeholder="Any special discounts or offers for event attendees..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="previousEvents">
                    Previous Event Experience
                  </Label>
                  <Textarea
                    id="previousEvents"
                    value={formData.previousEvents}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        previousEvents: e.target.value,
                      })
                    }
                    placeholder="List previous events you've participated in..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 5: Documents & Financial */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="businessLicense">Business License</Label>
                    <Input
                      id="businessLicense"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload("businessLicense", e)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="insuranceCertificate">
                      Insurance Certificate
                    </Label>
                    <Input
                      id="insuranceCertificate"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        handleFileUpload("insuranceCertificate", e)
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Payment Methods Accepted</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    {[
                      "Cash",
                      "Credit Card",
                      "Debit Card",
                      "Digital Wallet",
                      "Bank Transfer",
                      "PayPal",
                      "Venmo",
                      "Other",
                    ].map((method) => (
                      <div key={method} className="flex items-center space-x-2">
                        <Checkbox
                          id={method}
                          checked={formData.paymentMethods.includes(method)}
                          onCheckedChange={(checked) =>
                            handlePaymentMethodChange(
                              method,
                              checked as boolean
                            )
                          }
                        />
                        <Label htmlFor={method}>{method}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountName">Bank Account Name</Label>
                    <Input
                      id="accountName"
                      value={formData.bankDetails.accountName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bankDetails: {
                            ...formData.bankDetails,
                            accountName: e.target.value,
                          },
                        })
                      }
                      placeholder="Account holder name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankDetails.bankName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bankDetails: {
                            ...formData.bankDetails,
                            bankName: e.target.value,
                          },
                        })
                      }
                      placeholder="Bank name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      value={formData.socialMedia.facebook}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialMedia: {
                            ...formData.socialMedia,
                            facebook: e.target.value,
                          },
                        })
                      }
                      placeholder="Facebook page"
                    />
                  </div>
                  <div>
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      value={formData.socialMedia.instagram}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialMedia: {
                            ...formData.socialMedia,
                            instagram: e.target.value,
                          },
                        })
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      value={formData.socialMedia.twitter}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialMedia: {
                            ...formData.socialMedia,
                            twitter: e.target.value,
                          },
                        })
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      value={formData.socialMedia.linkedin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialMedia: {
                            ...formData.socialMedia,
                            linkedin: e.target.value,
                          },
                        })
                      }
                      placeholder="LinkedIn profile"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="specialRequests">Special Requests</Label>
                  <Textarea
                    id="specialRequests"
                    value={formData.specialRequests}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialRequests: e.target.value,
                      })
                    }
                    placeholder="Any special requests or requirements..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="marketingPermission"
                      checked={formData.marketingPermission}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          marketingPermission: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="marketingPermission">
                      I agree to receive marketing communications
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dataProcessingConsent"
                      checked={formData.dataProcessingConsent}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          dataProcessingConsent: checked as boolean,
                        })
                      }
                      required
                    />
                    <Label htmlFor="dataProcessingConsent">
                      I consent to the processing of my personal data *
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="termsAccepted"
                      checked={formData.termsAccepted}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          termsAccepted: checked as boolean,
                        })
                      }
                      required
                    />
                    <Label htmlFor="termsAccepted">
                      I accept the terms and conditions *
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6">
              <div className="flex space-x-2">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="buttonOutline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                  >
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex space-x-2">
                <Button type="button" variant="buttonOutline" onClick={onClose}>
                  Cancel
                </Button>
                {currentStep < 5 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={
                      !formData.dataProcessingConsent || !formData.termsAccepted
                    }
                  >
                    Submit Request
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
