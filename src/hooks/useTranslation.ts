import { useAuth } from '../contexts/AuthContext';
import { translations } from '../translations';

export function useTranslation() {
    const { language } = useAuth();

    const t = (key: string) => {
        const langData = translations[language] || translations['pt'];
        // @ts-ignore - Simple key access for now
        return langData[key] || key;
    };

    return { t, language };
}
