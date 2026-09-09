import { requireSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const { user } = await requireSession();

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-lg font-semibold">Settings</h1>
      <dl className="flex flex-col gap-1 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email}</dd>
      </dl>
    </div>
  );
}
