import React from "react";
import { Lightbulb, Award } from "lucide-react";
import type { AIRecommendation } from "../types/evaluation.types";

interface RecommendationsSectionProps {
  recommendations: AIRecommendation;
}

const RecommendationsSection: React.FC<RecommendationsSectionProps> = ({ recommendations }) => {
  if (!recommendations || !recommendations.bullets || recommendations.bullets.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header with Premium Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-[#F39C12]" />
          <h2 className="text-xl font-bold text-[#222223]">Pour aller plus loin</h2>
        </div>
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
          <Award className="h-3.5 w-3.5" />
          <span>Premium</span>
        </div>
      </div>

      {/* Introduction Text */}
      <p className="text-[#555555] mb-6 leading-relaxed">
        {recommendations.intro}
      </p>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.bullets.map((bullet, index) => (
          <div
            key={index}
            className="border-l-4 border-[#F39C12] bg-orange-50/50 p-4 rounded-r-lg hover:bg-orange-50 transition-colors"
          >
            <h3 className="font-semibold text-[#222223] mb-2 flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#F39C12] text-white text-sm font-bold mr-2 flex-shrink-0 mt-0.5">
                {index + 1}
              </span>
              <span className="flex-1">{bullet.title}</span>
            </h3>
            <p className="text-[#555555] ml-8 leading-relaxed">
              {bullet.explanation}
            </p>
          </div>
        ))}
      </div>

      {/* Footer Note */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-[#707070] italic">
          Ces recommandations sont générées par IA en analysant ta performance et le cours EDN.
          Elles sont personnalisées pour t'aider à progresser efficacement.
        </p>
      </div>
    </div>
  );
};

export default RecommendationsSection;

