import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "./wizard";

export const dynamic = "force-dynamic";

type OnboardingState = {
  step?: number;
  target_cert?: string;
  exam_date?: string;
  preferred_hours?: string[];
  language?: string;
  first_question_asked?: boolean;
  completed_at?: string;
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, onboarding_state, learning_prefs")
    .eq("id", user.id)
    .single();

  const state = (profile?.onboarding_state ?? {}) as OnboardingState;
  if (state.completed_at) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <OnboardingWizard
        userName={profile?.name ?? null}
        initialState={state}
      />
    </div>
  );
}
