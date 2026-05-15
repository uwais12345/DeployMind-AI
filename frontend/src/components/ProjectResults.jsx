import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, Zap, Shield, FileCode, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

export default function ProjectResults({ result }) {
  if (!result || !result.analysis) return null;

  const { analysis, framework } = result;
  const scoreColor = analysis.score >= 80 ? 'text-green-500' : analysis.score >= 50 ? 'text-yellow-500' : 'text-red-500';
  const scoreBg = analysis.score >= 80 ? 'from-green-500/20 to-green-500/5' : analysis.score >= 50 ? 'from-yellow-500/20 to-yellow-500/5' : 'from-red-500/20 to-red-500/5';

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 w-full max-w-4xl mx-auto">
      
      {/* Header & Score Section */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Score Card */}
        <Card className={`col-span-1 md:col-span-1 border-0 bg-gradient-to-br ${scoreBg} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap className="w-32 h-32" />
          </div>
          <CardContent className="p-8 flex flex-col items-center justify-center h-full relative z-10 text-center space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Deploy Readiness</h3>
            <div className={`text-6xl font-black ${scoreColor}`}>
              {analysis.score}
            </div>
            <p className="text-sm text-muted-foreground">{analysis.summary}</p>
          </CardContent>
        </Card>

        {/* Project Info Card */}
        <Card className="col-span-1 md:col-span-2 bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-primary" />
              Project Analysis Complete
            </CardTitle>
            <CardDescription>Groq AI has analyzed your {framework} project structure.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                 <div className="text-sm text-muted-foreground mb-1">Detected Framework</div>
                 <div className="font-semibold">{framework}</div>
               </div>
               <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                 <div className="text-sm text-muted-foreground mb-1">Status</div>
                 <div className="font-semibold flex items-center gap-2 text-green-500">
                   <CheckCircle2 className="w-4 h-4" /> Ready for Pipeline
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>

      </motion.div>

      {/* Issues & Recommendations */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-5 h-5" />
              Potential Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.issues && analysis.issues.length > 0 ? (
              <ul className="space-y-3">
                {analysis.issues.map((issue, idx) => (
                  <motion.li 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (idx * 0.1) }}
                    className="flex items-start gap-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20"
                  >
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{issue}</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground p-4 bg-muted/20 rounded-md">
                <Check className="w-4 h-4 text-green-500" />
                <span>No issues detected.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-500">
              <Shield className="w-5 h-5" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.recommendations && analysis.recommendations.length > 0 ? (
              <ul className="space-y-3">
                {analysis.recommendations.map((rec, idx) => (
                  <motion.li 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (idx * 0.1) }}
                    className="flex items-start gap-3 p-3 rounded-md bg-blue-500/10 border border-blue-500/20"
                  >
                    <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground p-4 bg-muted/20 rounded-md text-sm">
                No further recommendations.
              </div>
            )}
          </CardContent>
        </Card>

      </motion.div>

    </motion.div>
  );
}
