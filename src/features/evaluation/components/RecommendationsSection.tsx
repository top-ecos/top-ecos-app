import React from "react";
import type { AIRecommendation } from "../types/evaluation.types";

interface RecommendationsSectionProps {
  recommendations: AIRecommendation;
  ednItemNumber?: string | null;
  ednItemName?: string | null;
}

const RecommendationsSection: React.FC<RecommendationsSectionProps> = ({ 
  recommendations,
  ednItemNumber,
  ednItemName 
}) => {
  if (!recommendations || !recommendations.bullets || recommendations.bullets.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header with EDN Badge */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#4299F6]">Pour aller plus loin...</h1>
        {ednItemNumber && (
          <div className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-medium max-w-md truncate">
            Item EDN {ednItemNumber}{ednItemName ? ` : ${ednItemName}` : ''}
          </div>
        )}
      </div>

      {/* Content area with light blue background */}
      <div className="bg-blue-50 rounded-lg p-5 space-y-5">
        {/* Introduction Text */}
        <p className="text-[#222223] leading-relaxed italic">
          {recommendations.intro}
        </p>

        {/* Recommendations List */}
        <div className="space-y-4">
          {recommendations.bullets.map((bullet, index) => (
            <div key={index} className="space-y-2">
              <h4 className="font-bold text-[#4299F6] flex items-start gap-2">
                <span className="text-[#4299F6] flex-shrink-0">→</span>
                <span className="flex-1">{bullet.title}</span>
              </h4>
              <p className="text-[#222223] leading-relaxed pl-5">
                {bullet.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecommendationsSection;

