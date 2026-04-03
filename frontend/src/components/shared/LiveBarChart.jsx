/**
 * LiveBarChart — animates as new responses arrive
 */
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];

export default function LiveBarChart({ aggregated = {}, correctOption }) {
  const labels = Object.keys(aggregated);
  const values = Object.values(aggregated);

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((label, i) =>
        label === correctOption ? '#10b981cc' : COLORS[i % COLORS.length] + 'cc'
      ),
      borderColor: labels.map((label, i) =>
        label === correctOption ? '#10b981' : COLORS[i % COLORS.length]
      ),
      borderWidth: 2,
      borderRadius: 8,
    }],
  };

  const options = {
    responsive: true,
    animation: { duration: 400 },
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#94a3b8', stepSize: 1 },
        grid: { color: '#2a2a45' },
      },
      x: {
        ticks: { color: '#e2e8f0', font: { size: 14, weight: '500' } },
        grid: { display: false },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
