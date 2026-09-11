import { requireSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const { user } = await requireSession();

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-lg font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-1 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
