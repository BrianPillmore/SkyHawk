import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { updateDocumentMeta } from '../../utils/seo';
import { trackEvent } from '../../utils/analytics';

export default function CheckoutCancel() {
  useEffect(() => {
    updateDocumentMeta({
      title: 'Payment Cancelled',
      description: 'Your GotRuf checkout was cancelled. No charges were made.',
    });

    trackEvent('checkout', 'purchase_cancelled');
  }, []);

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Cancel icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-8">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-4xl font-black text-gray-900">Payment Cancelled</h1>

        <p className="mt-4 text-xl text-gray-500">
          Your checkout was cancelled. No charges were made to your account.
        </p>

        <p className="mt-6 text-gray-400">
          Changed your mind? No worries. Your first report is still free, and you can come back anytime.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm"
          >
            Back to Pricing
          </Link>
          <Link
            to="/"
            className="text-gray-600 hover:text-gray-900 font-medium py-3 px-6 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </section>
  );
}
