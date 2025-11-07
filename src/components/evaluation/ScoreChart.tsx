import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
interface ScoreChartProps {
  clinicalScore: number;
  communicationScore: number;
  maxClinicalScore: number;
  maxCommunicationScore: number;
  finalScore: number;
}
export const ScoreChart = ({
  clinicalScore,
  communicationScore,
  maxClinicalScore,
  maxCommunicationScore,
  finalScore
}: ScoreChartProps) => {
  const barData = [{
    name: 'Aptitudes cliniques',
    score: clinicalScore,
    maxScore: maxClinicalScore,
    percentage: clinicalScore / maxClinicalScore * 100
  }, {
    name: 'Communication',
    score: communicationScore,
    maxScore: maxCommunicationScore,
    percentage: communicationScore / maxCommunicationScore * 100
  }];
  const pieData = [{
    name: 'Score obtenu',
    value: finalScore,
    color: 'hsl(var(--primary))'
  }, {
    name: 'Marge de progression',
    value: 20 - finalScore,
    color: 'hsl(var(--muted))'
  }];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Répartition des scores</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="percentage" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Score final sur 20</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};