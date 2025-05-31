import React from 'react';

interface InvoiceData {
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientCountry: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
  total: string;
}

export default function InvoiceTemplate({ data }: { data: InvoiceData }) {
  return (
    <div className="w-[210mm] min-h-[297mm] mx-auto p-8 text-xs font-sans bg-white text-black">
      <div className="flex justify-between text-xs mb-6">
        <div>
          <p className="font-bold text-sm">SOLUCIONES CHANO</p>
          <p className="text-xs">C. Camarote #121 Tel. (939) 165-46-35</p>

          <div className="mt-4">
            <p className="font-bold text-sm">FACTURAR A</p>
            <p className="text-xs">{data.clientName}</p>
            <p className="text-xs">{data.clientAddress}</p>
            <p className="text-xs">{data.clientCity}</p>
            <p className="text-xs">{data.clientCountry}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs">
            <span className="font-bold">No. de Factura:</span>{' '}
            {data.invoiceNumber}
          </p>
          <p className="text-xs">
            <span className="font-bold">Fecha de emisión:</span>{' '}
            {data.issueDate}
          </p>
        </div>
      </div>

      <table className="w-full text-left border-t border-b border-gray-300 mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 font-semibold text-xs w-[40%]">Descripción</th>
            <th className="p-2 font-semibold text-xs w-[15%]">Cantidad</th>
            <th className="p-2 font-semibold text-xs w-[20%]">
              Precio unitario
            </th>
            <th className="p-2 font-semibold text-xs w-[15%]">Importe</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={index} className="border-t border-gray-200">
              <td className="p-2 text-xs">{item.description}</td>
              <td className="p-2 text-xs">{item.quantity}</td>
              <td className="p-2 text-xs">${item.unitPrice}</td>
              <td className="p-2 text-xs">${item.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-1/3">
          <div className="flex justify-between border-t border-gray-300 py-2">
            <span className="font-semibold text-xs">TOTAL (MXN):</span>
            <span className="text-xs">${data.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
