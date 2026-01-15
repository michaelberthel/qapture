import { useEffect, useState } from 'react';
import { SurveyCreatorComponent, SurveyCreator } from 'survey-creator-react';
import 'survey-core/defaultV2.min.css';
import 'survey-creator-core/survey-creator-core.min.css';
import { editorLocalization } from "survey-creator-core";

editorLocalization.currentLocale = "de";

interface SurveyCreatorWidgetProps {
    json: string;
    onSave: (json: string) => void;
}

export default function SurveyCreatorWidget({ json, onSave }: SurveyCreatorWidgetProps) {
    const [creator, setCreator] = useState<SurveyCreator | null>(null);

    useEffect(() => {
        const options = {
            showLogicTab: true,
            isAutoSave: true
        };
        const newCreator = new SurveyCreator(options);
        newCreator.text = json;
        newCreator.saveSurveyFunc = (saveNo: number, callback: (no: number, success: boolean) => void) => {
            onSave(newCreator.text);
            callback(saveNo, true);
        };
        setCreator(newCreator);
    }, []); // Only init once

    if (!creator) return <div>Loading Creator...</div>;

    return (
        <div style={{ height: '80vh' }}>
            <SurveyCreatorComponent creator={creator} />
        </div>
    );
}
