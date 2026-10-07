export interface Activity { id: string; time: string; title: string; location: string; description: string; lat?: number; lng?: number }
export interface Day { id: string; date: string; activities: Activity[] }
export interface PackingItem { id: string; category: string; item: string; packed: boolean; quantity: number }
export interface Expense { id: string; date: string; category: string; description: string; amount: number; currency: string }
export interface Trip {
  id: string; name: string; destination: string; startDate: string; endDate: string; budget: number
  itinerary: Day[]; packingList: PackingItem[]; expenses: Expense[]; notes: string; createdAt: string; updatedAt: string
}
