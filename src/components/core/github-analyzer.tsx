
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Github, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateProfileInsights } from "@/ai/flows/generate-profile-insights";
import { generatePersonalizedTips } from "@/ai/flows/generate-personalized-tips";
import { analyzePinnedRepos } from "@/ai/flows/analyze-pinned-repos";
import type { AnalysisResult, Repo, GitHubUser, PinnedRepo } from "@/types";
import { Dashboard } from "./dashboard";
import { Skeleton } from "../ui/skeleton";

const processLanguageData = (repos: Repo[]) => {
    const langCount = repos.reduce((acc, repo) => {
        if (repo.language) {
            acc[repo.language] = (acc[repo.language] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(langCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
};

const generateCommitActivity = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map(month => ({
        name: month,
        total: Math.floor(Math.random() * 100) + 10,
    }));
};

const createProfileSummary = (user: GitHubUser): string => {
  return `
- Bio: ${user.bio || 'Not provided'}
- Company: ${user.company || 'Not provided'}
- Location: ${user.location || 'Not provided'}
- Blog/Website: ${user.blog || 'Not provided'}
- Followers: ${user.followers}
- Following: ${user.following}
- Public Repos: ${user.public_repos}
  `.trim();
}

const createRepoSummary = (repos: Repo[]): string => {
  return repos
    .slice(0, 5) // Analyze top 5 repos
    .map(repo => `
- Repo: ${repo.name}
  - Stars: ${repo.stargazers_count}
  - Forks: ${repo.forks_count}
  - Language: ${repo.language || 'Not specified'}
  - Description: ${repo.description || 'Not provided'}
    `.trim())
    .join('\n');
}

export function GithubAnalyzer() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async (userToAnalyze: string) => {
    if (!userToAnalyze) {
      toast({
        title: "Username required",
        description: "Please enter a GitHub username to analyze.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setAnalysisResult(null);
    setUsername("");

    try {
      const userRes = await fetch(`https://api.github.com/users/${userToAnalyze}`);
      const repoRes = await fetch(`https://api.github.com/users/${userToAnalyze}/repos?sort=pushed&per_page=100`);
      const pinnedRepoRes = await fetch(`/api/github-pinned-repos?username=${userToAnalyze}`);

      if (userRes.status === 404) {
        toast({
            title: "User not found",
            description: `Could not find a GitHub user with the username "${userToAnalyze}".`,
            variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!userRes.ok || !repoRes.ok || !pinnedRepoRes.ok) {
        throw new Error('Failed to fetch data from GitHub.');
      }

      const user = await userRes.json();
      const repos: Repo[] = await repoRes.json();
      const pinnedRepos: PinnedRepo[] = await pinnedRepoRes.json();
      
      const insightsPromise = generateProfileInsights({
        username: user.login,
        profileSummary: createProfileSummary(user),
        repoSummary: createRepoSummary(repos),
      });

      const pinnedRepoAnalysisPromise = pinnedRepos.length > 0 
        ? analyzePinnedRepos(pinnedRepos.map(r => ({ name: r.name, description: r.description })))
        : Promise.resolve([]);

      const [insightsResult, pinnedRepoAnalysis] = await Promise.all([insightsPromise, pinnedRepoAnalysisPromise]);

      const profileAnalysisSummary = `Strengths:\n- ${insightsResult.profileStrengths.join('\n- ')}\n\nAreas for Improvement:\n- ${insightsResult.areasForImprovement.join('\n- ')}`;
      const tipsResult = await generatePersonalizedTips({
        profileAnalysis: profileAnalysisSummary,
        userGoals: "Improve open source presence, contribution consistency, and collaboration skills.",
      });

      setAnalysisResult({
        user,
        repos,
        pinnedRepos,
        profileStrengths: insightsResult.profileStrengths,
        areasForImprovement: insightsResult.areasForImprovement,
        ratings: insightsResult.ratings,
        tips: tipsResult.tips,
        contributionStrategies: tipsResult.contributionStrategies,
        languageData: processLanguageData(repos),
        commitActivity: generateCommitActivity(),
        pinnedRepoAnalysis,
      });

    } catch (error) {
      console.error("Analysis failed:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section id="analyzer" className="container mx-auto max-w-5xl py-12 px-4 text-center">
        <div className="mb-8">
          <Github className="mx-auto h-16 w-16 text-foreground" />
          <h1 className="mt-4 text-4xl font-bold tracking-tight font-headline sm:text-5xl">
            AI GitHub Analyzer
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Enter a GitHub username to get a deep, AI-powered analysis of their profile and contributions.
          </p>
        </div>

        <Card className="shadow-sm bg-card border">
          <CardContent className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAnalyze(username);
              }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Input
                type="text"
                placeholder="Enter Your Github Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="flex-grow text-base h-11"
              />
              <Button type="submit" disabled={loading} size="lg" className="h-11 bg-primary/90 hover:bg-primary">
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Github className="mr-2 h-5 w-5" />
                )}
                Analyze Profile
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
      
      {loading && (
        <div className="container mx-auto max-w-screen-xl p-4 sm:p-6 lg:p-8 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-6 flex flex-col items-center lg:items-start">
                  <Skeleton className="h-40 w-40 rounded-full" />
                  <div className="space-y-3 w-full mt-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                  </div>
                  <Skeleton className="h-11 w-full mt-4" />
                   <div className="space-y-2 w-full mt-4">
                        <Skeleton className="h-5 w-5/6" />
                        <Skeleton className="h-5 w-4/6" />
                        <Skeleton className="h-5 w-3/6" />
                    </div>
                </div>
                <div className="lg:col-span-3 space-y-8">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {analysisResult && !loading && <Dashboard result={analysisResult} />}
    </>
  );
}
