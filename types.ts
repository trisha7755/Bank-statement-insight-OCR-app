
export interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  notes: string;
  sourceFile: string;
}

export interface Summary {
  totalTransactions: number;
  totalIncome: number;
  totalSpending: number;
}

export interface DateFilter {
  startDate: string | null;
  endDate: string | null;
}
