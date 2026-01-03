import { ExternalLink, MapPin, Zap } from 'lucide-react';

export default function ExternalServices() {
    const platforms = [
        {
            id: 'viaverde',
            name: 'Via Verde',
            description: 'Gestão de portagens e identificadores.',
            url: 'https://www.viaverde.pt/minha-via-verde/login',
            icon: Zap,
            color: 'bg-emerald-600',
            hoverColor: 'hover:bg-emerald-500',
            textColor: 'text-emerald-500'
        },
        {
            id: 'bp',
            name: 'BP Frota',
            description: 'Gestão de cartões de combustível BP Plus.',
            url: 'https://www.bpplus.com/site/formlogin.asp?lstcountries=PTPOR',
            icon: FuelIcon, // Using a local wrapper or generic icon
            color: 'bg-green-700', // BP Green
            hoverColor: 'hover:bg-green-600',
            textColor: 'text-green-500'
        },
        {
            id: 'cartrack',
            name: 'Cartrack',
            description: 'Localização em tempo real e gestão de frota.',
            url: 'https://fleetweb-pt.cartrack.com/login',
            icon: MapPin,
            color: 'bg-orange-600',
            hoverColor: 'hover:bg-orange-500',
            textColor: 'text-orange-500'
        }
    ];

    return (
        <div className="max-w-7xl mx-auto p-8">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <ExternalLink className="w-6 h-6 text-indigo-500" />
                </div>
                Plataformas Externas
            </h1>
            <p className="text-slate-400 mb-8">Acesso rápido aos portais de gestão de frota e serviços externos.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {platforms.map(platform => (
                    <a
                        key={platform.id}
                        href={platform.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 hover:border-slate-600 transition-all hover:-translate-y-1 shadow-2xl overflow-hidden"
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 ${platform.color} opacity-10 rounded-bl-[100px] transition-all group-hover:scale-110`}></div>

                        <div className={`w-14 h-14 rounded-2xl ${platform.color} flex items-center justify-center mb-6 shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-300`}>
                            <platform.icon className="w-8 h-8 text-white" />
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-2">{platform.name}</h3>
                        <p className="text-slate-400 mb-6 min-h-[48px]">{platform.description}</p>

                        <div className={`flex items-center gap-2 font-bold ${platform.textColor} group-hover:translate-x-2 transition-transform`}>
                            Aceder ao Portal <ExternalLink className="w-4 h-4" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

function FuelIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 22v-8a2 2 0 0 1 2-2h2.5a2 2 0 0 1 2 2v8" />
            <path d="M15 10a2 2 0 0 1 2-2h2.5a2 2 0 0 1 2 2v8" />
            <path d="M8 6h9" />
            <path d="M11 6V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v20" />
            <path d="M14 13h1" />
        </svg>
    )
}
