"use client";

import { Card } from "@/components/ui/card";
import { AlertTriangle, Home, Sigma, RefreshCw, Zap } from "lucide-react";

// This page implements the "Grid Topology.png" UI.
// The SVG diagram is rendered with conditional styles based on fault status.
export default function TopologyPage() {
  const activeFaults = 1;
  const selfHealingStatus = "Active";

  const linePathClass = "transition-all duration-500";
  const activeLineColor = "#10B981"; // Green
  const faultLineColor = "#EF4444"; // Red

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Grid Topology</h2>
        <p className="text-slate-400">
          Real-time electrical grid monitoring and fault detection
        </p>
      </div>

      <Card className="bg-slate-800 border-slate-700 p-8">
        <div className="w-full max-w-4xl mx-auto">
          <svg viewBox="0 0 800 300" className="w-full">
            {/* Lines */}
            <line
              x1="120"
              y1="100"
              x2="250"
              y2="100"
              stroke={activeLineColor}
              strokeWidth="3"
              className={linePathClass}
            />
            <line
              x1="350"
              y1="100"
              x2="450"
              y2="100"
              stroke={activeFaults > 0 ? faultLineColor : activeLineColor}
              strokeWidth="3"
              className={linePathClass}
            />
            <line
              x1="550"
              y1="100"
              x2="650"
              y2="100"
              stroke={activeLineColor}
              strokeWidth="3"
              className={linePathClass}
            />
            <path
              d="M 100 100 L 100 200 L 700 200 L 700 100"
              stroke={activeLineColor}
              strokeWidth="3"
              fill="none"
              className={linePathClass}
            />

            {/* Nodes */}
            <g transform="translate(40, 80)">
              <rect width="80" height="40" fill="#3B82F6" rx="8" />
              <text
                x="55"
                y="25"
                fill="white"
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
              >
                PLN
              </text>
              <Zap x="12" y="12" color="white" size="16" />
            </g>

            {["Zone 1", "Zone 2", "Zone 3"].map((name, index) => (
              <g key={name} transform={`translate(${200 * index + 250}, 80)`}>
                <rect
                  width="100"
                  height="40"
                  fill={index === 1 && activeFaults > 0 ? "#DC2626" : "#16A34A"}
                  rx="8"
                  className="transition-colors duration-500"
                />
                <text
                  x="65"
                  y="25"
                  fill="white"
                  textAnchor="middle"
                  fontSize="14"
                >
                  {name}
                </text>
                <Home x="10" y="12" color="white" size="16" />
              </g>
            ))}

            {/* Fault Icon */}
            {activeFaults > 0 && (
              <g transform="translate(395, 85)">
                <AlertTriangle
                  className="text-yellow-400"
                  fill="currentColor"
                  size={30}
                />
              </g>
            )}

            {/* Self-Healing Relay */}
            <g transform="translate(550, 180)">
              <rect width="140" height="50" fill="#0EA5E9" rx="8" />
              <text
                x="85"
                y="30"
                fill="white"
                textAnchor="middle"
                fontSize="14"
              >
                Self-Healing Relay
              </text>
              <RefreshCw x="10" y="15" color="white" size="20" />
            </g>
          </svg>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-800 border-slate-700 p-6 flex flex-col items-center justify-center text-center">
          <Sigma className="w-10 h-10 text-blue-400 mb-3" />
          <p className="text-4xl font-bold">3</p>
          <p className="text-sm text-slate-400 uppercase tracking-wider">
            Total Zones
          </p>
        </Card>
        <Card className="bg-slate-800 border-slate-700 p-6 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-4xl font-bold">{activeFaults}</p>
          <p className="text-sm text-slate-400 uppercase tracking-wider">
            Active Faults
          </p>
        </Card>
        <Card className="bg-slate-800 border-slate-700 p-6 flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-10 h-10 text-yellow-400 mb-3" />
          <p className="text-2xl font-bold">{selfHealingStatus}</p>
          <p className="text-sm text-slate-400 uppercase tracking-wider">
            Self-Healing
          </p>
        </Card>
      </div>
    </div>
  );
}
