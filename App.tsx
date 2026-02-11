
import React, { useState, useCallback, useMemo } from 'react';
import { analyzeStatements, generateFinancialInsights } from './services/geminiService';
import type { Transaction, Summary, DateFilter } from './types';
import FileUpload from './components/FileUpload';
import TransactionTable from './components/TransactionTable';
import SummaryCard from './components/SummaryCard';
import Spinner from './components/Spinner';
import Alert from './components/Alert';
import { DollarSignIcon, ListChecksIcon, LogoIcon } from './components/icons';
import CategoryInsights from './components/CategoryInsights';
import FinancialInsights from './components/FinancialInsights';
import FilterControls from './components/FilterControls';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>({ startDate: null, endDate: null });

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsLoading(true);
    setIsGeneratingInsights(true);
    setError(null);
    setTransactions([]);
    setInsights([]);

    try {
      const extractedTransactions = await analyzeStatements(files);
      extractedTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTransactions(extractedTransactions);
      
      try {
        const generatedInsights = await generateFinancialInsights(extractedTransactions);
        setInsights(generatedInsights);
      } catch (insightError) {
        console.error("Failed to generate insights:", insightError);
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred. Please check the console and try again.');
    } finally {
      setIsLoading(false);
      setIsGeneratingInsights(false);
    }
  }, []);

  const uniqueCategories = useMemo(() => {
    if (transactions.length === 0) return [];
    const categories = new Set(transactions.map(t => t.category));
    return Array.from(categories).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const categoryMatch = categoryFilter === 'all' || t.category === categoryFilter;
      
      // Date parsing needs to be robust for comparison
      const transactionDate = new Date(t.date + 'T00:00:00'); // Assume local timezone if not specified
      const startDate = dateFilter.startDate ? new Date(dateFilter.startDate + 'T00:00:00') : null;
      const endDate = dateFilter.endDate ? new Date(dateFilter.endDate + 'T00:00:00') : null;

      const startDateMatch = !startDate || transactionDate >= startDate;
      const endDateMatch = !endDate || transactionDate <= endDate;
      
      return categoryMatch && startDateMatch && endDateMatch;
    });
  }, [transactions, categoryFilter, dateFilter]);

  const summary: Summary | null = useMemo(() => {
    if (filteredTransactions.length === 0 && transactions.length > 0) return { totalTransactions: 0, totalIncome: 0, totalSpending: 0 };
    if (filteredTransactions.length === 0) return null;

    return filteredTransactions.reduce((acc, transaction) => {
        acc.totalTransactions += 1;
        if (transaction.type === 'income') {
          acc.totalIncome += transaction.amount;
        } else {
          acc.totalSpending += transaction.amount;
        }
        return acc;
      }, { totalTransactions: 0, totalIncome: 0, totalSpending: 0 });
  }, [filteredTransactions, transactions]);

  const topCategories = useMemo(() => {
    if (filteredTransactions.length === 0) {
      return { topIncome: [], topExpenses: [] };
    }

    const income: { [key: string]: number } = {};
    const expenses: { [key: string]: number } = {};

    filteredTransactions.forEach(transaction => {
      const category = transaction.category || 'Miscellaneous';
      if (transaction.type === 'income') {
        income[category] = (income[category] || 0) + transaction.amount;
      } else {
        expenses[category] = (expenses[category] || 0) + transaction.amount;
      }
    });

    const processAndSort = (categoryMap: { [key: string]: number }) => {
      return Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
    };

    return {
      topIncome: processAndSort(income),
      topExpenses: processAndSort(expenses),
    };
  }, [filteredTransactions]);
  
  const handleReset = () => {
    setTransactions([]);
    setInsights([]);
    setError(null);
    setIsLoading(false);
    setCategoryFilter('all');
    setDateFilter({ startDate: null, endDate: null });
  };

  const resetFilters = () => {
    setCategoryFilter('all');
    setDateFilter({ startDate: null, endDate: null });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between pb-8 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4 sm:mb-0">
            <LogoIcon className="h-10 w-10 text-indigo-600" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bank Statement Insights</h1>
              <p className="text-sm text-gray-600">Extract & analyze transactions with Gemini</p>
            </div>
          </div>
          {transactions.length > 0 && !isLoading && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Analyze New Statements
              </button>
          )}
        </header>

        <main className="mt-8">
          {error && <Alert message={error} onClose={() => setError(null)} />}
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center text-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
              <Spinner />
              <p className="mt-4 text-lg font-semibold text-gray-700">Analyzing your statements...</p>
              <p className="text-gray-500">This may take a few moments. Please don't close the tab.</p>
            </div>
          ) : transactions.length === 0 ? (
            <FileUpload onFilesUploaded={handleFileUpload} />
          ) : (
            <div>
              {summary && (
                <section aria-labelledby="summary-title" className="mb-8">
                  <h2 id="summary-title" className="text-xl font-bold text-gray-900 mb-4">Financial Summary</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard 
                      title="Total Transactions" 
                      value={summary.totalTransactions}
                      icon={<ListChecksIcon className="h-6 w-6 text-indigo-500"/>}
                    />
                    <SummaryCard 
                      title="Total Income" 
                      value={`$${summary.totalIncome.toFixed(2)}`}
                      icon={<DollarSignIcon className="h-6 w-6 text-emerald-500"/>}
                      valueColor="text-emerald-600"
                    />
                    <SummaryCard 
                      title="Total Spending" 
                      value={`$${summary.totalSpending.toFixed(2)}`}
                      icon={<DollarSignIcon className="h-6 w-6 text-rose-500"/>}
                      valueColor="text-rose-600"
                    />
                  </div>
                </section>
              )}

              <FinancialInsights insights={insights} isLoading={isGeneratingInsights} />

              <FilterControls
                categories={uniqueCategories}
                onCategoryChange={setCategoryFilter}
                onDateChange={setDateFilter}
                currentCategory={categoryFilter}
                currentDates={dateFilter}
                onReset={resetFilters}
              />

              <CategoryInsights 
                topIncome={topCategories.topIncome} 
                topExpenses={topCategories.topExpenses} 
              />

              <section aria-labelledby="transactions-title" className="mt-8">
                 <h2 id="transactions-title" className="text-xl font-bold text-gray-900 mb-4">Filtered Transactions</h2>
                <TransactionTable transactions={filteredTransactions} />
              </section>
            </div>
          )}
        </main>
        
        <footer className="text-center mt-12 py-4 text-sm text-gray-500 border-t border-gray-200">
          <p>Powered by Google Gemini. For demonstration purposes only.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
