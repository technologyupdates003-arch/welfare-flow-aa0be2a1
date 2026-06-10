import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function RegistrationApiDocs() {
  const [copiedCode, setCopiedCode] = useState("");

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const endpoints = [
    {
      title: "Get Registration Configuration",
      method: "GET",
      path: "/member-registration/config",
      description: "Retrieve current registration requirements and fee",
      auth: false,
      example: `curl -X GET \\
  https://project.supabase.co/functions/v1/member-registration/config`,
      response: {
        retiring_date: "2027-12-31",
        registration_fee: 1000,
        active: true,
        message: "Join our welfare group",
      },
    },
    {
      title: "Submit Member Registration",
      method: "POST",
      path: "/member-registration/register",
      description: "Submit new member registration form",
      auth: false,
      example: `curl -X POST \\
  https://project.supabase.co/functions/v1/member-registration/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "full_name": "John Doe",
    "phone_number": "0712345678",
    "department": "IT",
    "working_location": "Nairobi"
  }'`,
      response: {
        success: true,
        registration_id: "550e8400-e29b-41d4-a716-446655440000",
        status: "payment_pending",
        registration_fee: 1000,
        message: "Please complete M-Pesa payment",
      },
    },
    {
      title: "Initiate Payment",
      method: "POST",
      path: "/member-registration/initiate-payment",
      description: "Start M-Pesa STK Push payment for registration fee",
      auth: false,
      example: `curl -X POST \\
  https://project.supabase.co/functions/v1/member-registration/initiate-payment \\
  -H "Content-Type: application/json" \\
  -d '{
    "registration_id": "550e8400-e29b-41d4-a716-446655440000",
    "phone_number": "0712345678"
  }'`,
      response: {
        success: true,
        checkout_request_id: "ws_CO_DMZ3BK9QR60",
        message: "Payment prompt sent to 0712345678. Enter your M-Pesa PIN.",
      },
    },
    {
      title: "Check Registration Status",
      method: "GET",
      path: "/member-registration/status/:id",
      description: "Check current status of a registration",
      auth: false,
      example: `curl -X GET \\
  https://project.supabase.co/functions/v1/member-registration/status/550e8400-e29b-41d4-a716-446655440000`,
      response: {
        success: true,
        registration_id: "550e8400-e29b-41d4-a716-446655440000",
        status: "verified",
        payment_status: "verified",
        message: "Your registration is verified. Awaiting admin approval.",
      },
    },
    {
      title: "List All Registrations",
      method: "GET",
      path: "/admin-registration/registrations",
      description: "Get list of all registrations with optional filters",
      auth: true,
      example: `curl -X GET \\
  "https://project.supabase.co/functions/v1/admin-registration/registrations?status=verified&page=1" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`,
      response: {
        success: true,
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            full_name: "John Doe",
            phone_number: "254712345678",
            status: "verified",
            payment_status: "verified",
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 100, totalPages: 5 },
      },
    },
    {
      title: "Get Registration Details",
      method: "GET",
      path: "/admin-registration/registrations/:id",
      description: "Get full details of a registration including payment info",
      auth: true,
      example: `curl -X GET \\
  https://project.supabase.co/functions/v1/admin-registration/registrations/550e8400 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`,
      response: {
        success: true,
        data: {
          id: "550e8400",
          full_name: "John Doe",
          phone_number: "254712345678",
          department: "IT",
          working_location: "Nairobi",
          status: "verified",
          payment_status: "verified",
          fees: [{ amount: 1000, status: "paid", verified_at: "2026-06-09T10:05:00Z" }],
        },
      },
    },
    {
      title: "Approve Registration",
      method: "POST",
      path: "/admin-registration/registrations/:id/approve",
      description: "Approve registration and send system access link via SMS",
      auth: true,
      example: `curl -X POST \\
  https://project.supabase.co/functions/v1/admin-registration/registrations/550e8400/approve \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "notes": "Approved - meets all requirements"
  }'`,
      response: {
        success: true,
        message: "Registration approved and SMS sent",
        data: {
          registration_id: "550e8400",
          system_link: "https://system.domain/register/token-here",
          temporary_password: "TEMP_PASSWORD_123",
        },
      },
    },
    {
      title: "Reject Registration",
      method: "POST",
      path: "/admin-registration/registrations/:id/reject",
      description: "Reject registration with reason",
      auth: true,
      example: `curl -X POST \\
  https://project.supabase.co/functions/v1/admin-registration/registrations/550e8400/reject \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "reason": "Does not meet retiring date requirement"
  }'`,
      response: {
        success: true,
        message: "Registration rejected and SMS sent to member",
      },
    },
    {
      title: "Update Registration Configuration",
      method: "PUT",
      path: "/admin-registration/config",
      description: "Update registration requirements (retiring date, fee, status)",
      auth: true,
      example: `curl -X PUT \\
  https://project.supabase.co/functions/v1/admin-registration/config \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "retiring_date": "2028-12-31",
    "registration_fee": 1500,
    "active": true
  }'`,
      response: {
        success: true,
        message: "Configuration updated successfully",
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-6 w-6" />
            Member Registration API Documentation
          </CardTitle>
          <CardDescription>
            Complete API reference for member registration endpoints
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Base URL Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded-lg font-mono text-sm break-all">
            https://your-project.supabase.co/functions/v1
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      {endpoints.map((endpoint, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{endpoint.title}</CardTitle>
                <CardDescription>{endpoint.description}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge className={endpoint.method === "GET" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                  {endpoint.method}
                </Badge>
                {endpoint.auth && <Badge variant="outline">Requires Auth</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Endpoint Path */}
            <div>
              <p className="text-sm font-semibold mb-2">Endpoint:</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm break-all">
                {endpoint.path}
              </div>
            </div>

            {/* Example */}
            <div>
              <p className="text-sm font-semibold mb-2">Example:</p>
              <div className="relative bg-muted p-3 rounded-lg">
                <pre className="font-mono text-xs overflow-auto whitespace-pre-wrap break-words">
                  {endpoint.example}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(endpoint.example)}
                >
                  {copiedCode === endpoint.example ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Response */}
            <div>
              <p className="text-sm font-semibold mb-2">Response:</p>
              <div className="bg-muted p-3 rounded-lg overflow-auto">
                <pre className="font-mono text-xs whitespace-pre-wrap break-words">
                  {JSON.stringify(endpoint.response, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Status Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Badge className="bg-green-600">200</Badge>
              <div>
                <p className="font-semibold text-sm">OK</p>
                <p className="text-sm text-muted-foreground">Request successful</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Badge className="bg-green-600">201</Badge>
              <div>
                <p className="font-semibold text-sm">Created</p>
                <p className="text-sm text-muted-foreground">Resource created successfully</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <Badge variant="destructive">400</Badge>
              <div>
                <p className="font-semibold text-sm">Bad Request</p>
                <p className="text-sm text-muted-foreground">Invalid parameters</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <Badge variant="destructive">401</Badge>
              <div>
                <p className="font-semibold text-sm">Unauthorized</p>
                <p className="text-sm text-muted-foreground">Missing or invalid authentication</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <Badge variant="destructive">403</Badge>
              <div>
                <p className="font-semibold text-sm">Forbidden</p>
                <p className="text-sm text-muted-foreground">Insufficient permissions</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <Badge variant="destructive">404</Badge>
              <div>
                <p className="font-semibold text-sm">Not Found</p>
                <p className="text-sm text-muted-foreground">Resource not found</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <Badge variant="destructive">500</Badge>
              <div>
                <p className="font-semibold text-sm">Server Error</p>
                <p className="text-sm text-muted-foreground">Internal server error</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Admin endpoints require a valid JWT token with admin role. Include the token in the Authorization header:
          </p>
          <div className="bg-muted p-3 rounded-lg font-mono text-sm break-all">
            Authorization: Bearer YOUR_JWT_TOKEN
          </div>
          <p className="text-xs text-muted-foreground">
            The token is obtained during login and is valid for 24 hours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
