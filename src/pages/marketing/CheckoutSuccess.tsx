import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getUserCredits } from '../../services/stripeApi';
import { updateDocumentMeta } from '../../utils/seo';
import { trackEvent } from '../../utils/analytics';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>('free');

  useEffect(() => {
    updateDocumentMeta({
      title: 'Payment Successful',
      description: 'Your GotRuf payment was processed successfully.',
    });

    trackEvent('checkout', 'purchase_complete', sessionId || undefined);

    // Fetch updated credits
    getUserCredits().then((data) => {
      setCredits(data.credits);
      setPlan(data.plan);
    });
  }, [sessionId]);

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Success icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full mb-8">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-4xl font-black text-gray-900">Payment Successful!</h1>

        <p className="mt-4 text-xl text-gray-500">
          Your payment has been processed and your account has been updated.
        </p>

        {credits !== null && (
          <div className="mt-8 bg-gray-50 rounded-2xl border border-gray-200 p-8">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
              Your Account
            </div>
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="text-4xl font-black text-gotruf-600">{credits}</div>
                <div className="text-sm text-gray-500">report credits</div>
              </div>
              <div className="h-12 w-px bg-gray-200" />
              <div>
                <div className="text-2xl font-bold text-gray-900 capitalize">{plan}</div>
                <div className="text-sm text-gray-500">current plan</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/pricing"
            className="text-gray-600 hover:text-gray-900 font-medium py-3 px-6 transition-colors"
          >
            Back to Pricing
          </Link>
        </div>

        {sessionId && (
          <p className="mt-8 text-xs text-gray-400">
            Session: {sessionId}
          </p>
        )}
      </div>
    </section>
  );
}
