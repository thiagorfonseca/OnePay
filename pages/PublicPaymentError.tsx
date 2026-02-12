import React from 'react';
import { Link } from 'react-router-dom';

const PublicPaymentError: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-800">Erro no pagamento</h1>
        <p className="text-sm text-gray-500">Não foi possível confirmar o pagamento. Tente novamente.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
};

export default PublicPaymentError;
