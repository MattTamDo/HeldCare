/** The signed-in staff member. A real build would read this from the session. */
export const CURRENT_USER = {
  name: "Thanh Do",
  firstName: "Thanh",
  role: "Care Team",
  initials: "TD",
};

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
