import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Heart,
  AlertTriangle,
  Pill,
  UserCheck,
  Edit,
  Trash2,
} from "lucide-react";

interface UserDetailViewProps {
  user: any;
  onClose: () => void;
  onEdit: (user: any) => void;
  onDelete: (userId: number) => void;
}

export function UserDetailView({
  user,
  onClose,
  onEdit,
  onDelete,
}: UserDetailViewProps) {
  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${user.name}? This action cannot be undone.`
      )
    ) {
      onDelete(user.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Details
              </CardTitle>
              <CardDescription>
                Complete profile information for {user.name}
              </CardDescription>
            </div>
            <Button variant="buttonOutline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Header with actions */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{user.name}</h3>
                <Badge variant="buttonOutline" className="mt-1">
                  {user.status === "active" ? "Active User" : user.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onEdit(user)}>
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>

          <Separator />

          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Basic Information
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">
                    {user.phone || "Not provided"}
                  </p>
                </div>
              </div>

              {user.dateOfBirth && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Date of Birth</p>
                    <p className="text-sm text-muted-foreground">
                      {user.dateOfBirth}
                    </p>
                  </div>
                </div>
              )}

              {user.gender && (
                <div>
                  <p className="text-sm font-medium">Gender</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {user.gender}
                  </p>
                </div>
              )}

              {user.bloodType && (
                <div>
                  <p className="text-sm font-medium">Blood Type</p>
                  <Badge variant="buttonOutline">{user.bloodType}</Badge>
                </div>
              )}
            </div>

            {user.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">
                    {user.address}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Emergency Contact */}
          {(user.emergencyContactName || user.emergencyContactPhone) && (
            <>
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Emergency Contact
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.emergencyContactName && (
                    <div>
                      <p className="text-sm font-medium">Contact Name</p>
                      <p className="text-sm text-muted-foreground">
                        {user.emergencyContactName}
                      </p>
                    </div>
                  )}

                  {user.emergencyContactPhone && (
                    <div>
                      <p className="text-sm font-medium">Contact Phone</p>
                      <p className="text-sm text-muted-foreground">
                        {user.emergencyContactPhone}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Medical Information */}
          {(user.allergies?.length > 0 ||
            user.chronicConditions?.length > 0 ||
            user.currentMedications?.length > 0) && (
            <>
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Medical Information
                </h4>

                {user.allergies?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                      Allergies
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {user.allergies.map((allergy: string, index: number) => (
                        <Badge
                          key={index}
                          variant="buttonOutline"
                          className="text-xs"
                        >
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {user.chronicConditions?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Chronic Conditions
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {user.chronicConditions.map(
                        (condition: string, index: number) => (
                          <Badge
                            key={index}
                            variant="buttonOutline"
                            className="text-xs"
                          >
                            {condition}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}

                {user.currentMedications?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2 mb-2">
                      <Pill className="h-3 w-3" />
                      Current Medications
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {user.currentMedications.map(
                        (medication: string, index: number) => (
                          <Badge
                            key={index}
                            variant="buttonOutline"
                            className="text-xs"
                          >
                            {medication}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Event Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Event Information
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium">Events Attended</p>
                <p className="text-2xl font-bold text-primary">
                  {user.totalEvents}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Last Event</p>
                <p className="text-sm text-muted-foreground">
                  {user.lastEvent}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge
                  variant={user.status === "active" ? "default" : "secondary"}
                >
                  {user.status}
                </Badge>
              </div>
            </div>

            {user.events?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Event History</p>
                <div className="flex flex-wrap gap-1">
                  {user.events.map((event: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Additional Notes */}
          {user.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Additional Notes</h4>
                <p className="text-sm text-muted-foreground">{user.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
