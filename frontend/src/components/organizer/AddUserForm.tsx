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
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  AlertTriangle,
  Pill,
} from "lucide-react";

interface AddUserFormProps {
  onClose: () => void;
  onSubmit: (userData: any) => void;
  editMode?: boolean;
  initialData?: any;
}

export function AddUserForm({
  onClose,
  onSubmit,
  editMode = false,
  initialData,
}: AddUserFormProps) {
  const [formData, setFormData] = useState({
    fullName: initialData?.name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    dateOfBirth: initialData?.dateOfBirth || "",
    gender: initialData?.gender || "",
    address: initialData?.address || "",
    emergencyContactName: initialData?.emergencyContactName || "",
    emergencyContactPhone: initialData?.emergencyContactPhone || "",
    bloodType: initialData?.bloodType || "",
    allergies: initialData?.allergies?.join(", ") || "",
    chronicConditions: initialData?.chronicConditions?.join(", ") || "",
    currentMedications: initialData?.currentMedications?.join(", ") || "",
    notes: initialData?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const processedData = {
      ...formData,
      allergies: formData.allergies
        ? formData.allergies.split(",").map((item) => item.trim())
        : [],
      chronicConditions: formData.chronicConditions
        ? formData.chronicConditions.split(",").map((item) => item.trim())
        : [],
      currentMedications: formData.currentMedications
        ? formData.currentMedications.split(",").map((item) => item.trim())
        : [],
    };

    onSubmit(processedData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {editMode ? "Edit User" : "Add New User"}
              </CardTitle>
              <CardDescription>
                {editMode
                  ? "Update user information"
                  : "Add a new user to your events"}
              </CardDescription>
            </div>
            <Button variant="buttonOutline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="user@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+1-555-0123"
                  />
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOfBirth: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not-to-say">
                        Prefer not to say
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bloodType">Blood Type</Label>
                  <Select
                    value={formData.bloodType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, bloodType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Enter complete address"
                  rows={2}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Emergency Contact
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContactName">
                    Emergency Contact Name
                  </Label>
                  <Input
                    id="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContactName: e.target.value,
                      })
                    }
                    placeholder="Contact person name"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContactPhone">
                    Emergency Contact Phone
                  </Label>
                  <Input
                    id="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContactPhone: e.target.value,
                      })
                    }
                    placeholder="+1-555-0123"
                  />
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Medical Information
              </h3>

              <div>
                <Label htmlFor="allergies" className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  Allergies
                </Label>
                <Input
                  id="allergies"
                  value={formData.allergies}
                  onChange={(e) =>
                    setFormData({ ...formData, allergies: e.target.value })
                  }
                  placeholder="List allergies separated by commas"
                />
              </div>

              <div>
                <Label htmlFor="chronicConditions">Chronic Conditions</Label>
                <Input
                  id="chronicConditions"
                  value={formData.chronicConditions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      chronicConditions: e.target.value,
                    })
                  }
                  placeholder="List chronic conditions separated by commas"
                />
              </div>

              <div>
                <Label
                  htmlFor="currentMedications"
                  className="flex items-center gap-2"
                >
                  <Pill className="h-3 w-3" />
                  Current Medications
                </Label>
                <Input
                  id="currentMedications"
                  value={formData.currentMedications}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currentMedications: e.target.value,
                    })
                  }
                  placeholder="List current medications separated by commas"
                />
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any additional notes or information..."
                rows={3}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="buttonOutline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {editMode ? "Update User" : "Add User"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
