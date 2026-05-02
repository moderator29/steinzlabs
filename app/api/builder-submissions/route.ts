import 'server-only';
import { NextResponse } from 'next/server';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

const URL_RE = /^https?:\/\/[^\s]+$/;
const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HANDLE_RE = /^[A-Za-z0-9_.@-]{1,64}$/;

function isAddr(v: unknown): boolean {
  if (typeof v !== 'string' || !v) return false;
  return EVM_ADDR_RE.test(v) || SOLANA_ADDR_RE.test(v);
}
function isUrlOrEmpty(v: unknown): boolean {
  if (v === '' || v == null) return true;
  return typeof v === 'string' && v.length <= 500 && URL_RE.test(v);
}
function isStr(v: unknown, max: number): boolean {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}
function isStrOrEmpty(v: unknown, max: number): boolean {
  return v === '' || v == null || (typeof v === 'string' && v.length <= max);
}
function isHandleOrEmpty(v: unknown): boolean {
  if (v === '' || v == null) return true;
  return typeof v === 'string' && HANDLE_RE.test(v);
}

interface BuilderApplication {
  id: string;
  name: string;
  role: string;
  skills: string[];
  bio: string;
  walletAddress: string;
  portfolio: string;
  github: string;
  twitter: string;
  website: string;
  experience: string;
  verified: boolean;
  reputationScore: number;
  completedProjects: number;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  endorsements: number;
}

interface FundingProject {
  id: string;
  name: string;
  description: string;
  category: string;
  chain: string;
  goal: number;
  raised: number;
  builder: string;
  builderName: string;
  verified: boolean;
  daysLeft: number;
  status: 'pending' | 'active' | 'funded' | 'completed' | 'rejected';
  teamSize: number;
  website: string;
  whitepaper: string;
  contractAddress: string;
  submittedAt: string;
  milestones: {
    name: string;
    description: string;
    amount: number;
    deliverables: string;
    status: 'completed' | 'in_progress' | 'locked' | 'pending_review';
    proofUrl?: string;
    completedAt?: string;
  }[];
  investors: number;
  tags: string[];
}

const builders: BuilderApplication[] = [
  {
    id: 'b1', name: 'Alex Chen', role: 'Full-Stack Developer', skills: ['Solidity', 'React', 'Node.js', 'TypeScript'],
    bio: 'Senior blockchain developer with 5 years experience building DeFi protocols. Previously at Aave and Compound.',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f3a7f1', portfolio: 'https://alexchen.dev',
    github: 'alexchen-dev', twitter: '@alexchen_web3', website: 'https://alexchen.dev',
    experience: '5 years in blockchain, 8 years total software engineering', verified: true,
    reputationScore: 94, completedProjects: 12, status: 'approved', appliedAt: '2024-01-15', endorsements: 23
  },
  {
    id: 'b2', name: 'Sarah Kim', role: 'Smart Contract Auditor', skills: ['Solidity', 'Vyper', 'Security', 'Formal Verification'],
    bio: 'Lead auditor specializing in DeFi security. Audited $2B+ in TVL across 50+ protocols.',
    walletAddress: '0x9f3a21C89f4Cb77b0d4E91Da22F2Cb36deb21c4a', portfolio: 'https://sarahkim-audit.com',
    github: 'sarahkim-security', twitter: '@sarahkim_audit', website: 'https://sarahkim-audit.com',
    experience: '4 years smart contract auditing, former Trail of Bits', verified: true,
    reputationScore: 97, completedProjects: 28, status: 'approved', appliedAt: '2024-02-01', endorsements: 41
  },
  {
    id: 'b3', name: 'Marcus Johnson', role: 'DeFi Protocol Engineer', skills: ['Rust', 'Solana', 'Anchor', 'Move'],
    bio: 'Solana ecosystem builder. Created multiple successful DEX aggregators on Solana.',
    walletAddress: '0x3e7b41dC8f4A2Fb0c15e6d87e94F5D7af4d81234', portfolio: 'https://marcusjohnson.xyz',
    github: 'marcus-solana', twitter: '@marcus_sol', website: 'https://marcusjohnson.xyz',
    experience: '3 years Solana development, launched 4 protocols', verified: true,
    reputationScore: 88, completedProjects: 8, status: 'approved', appliedAt: '2024-03-10', endorsements: 15
  },
  {
    id: 'b4', name: 'Priya Patel', role: 'Frontend Developer', skills: ['React', 'Next.js', 'TypeScript', 'Web3.js'],
    bio: 'Web3 frontend specialist. Passionate about making DeFi accessible to everyone.',
    walletAddress: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', portfolio: 'https://priyapatel.dev',
    github: 'priya-web3', twitter: '@priya_builds', website: 'https://priyapatel.dev',
    experience: '2 years Web3, 6 years React development', verified: false,
    reputationScore: 72, completedProjects: 15, status: 'approved', appliedAt: '2024-04-05', endorsements: 8
  },
  {
    id: 'b5', name: 'David Liu', role: 'Blockchain Architect', skills: ['Cosmos SDK', 'Go', 'Rust', 'Zero Knowledge'],
    bio: 'Cross-chain infrastructure architect. Building the interoperability layer for Web3.',
    walletAddress: '0xd5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4', portfolio: 'https://davidliu.xyz',
    github: 'david-cosmos', twitter: '@davidliu_zk', website: 'https://davidliu.xyz',
    experience: '6 years distributed systems, 4 years blockchain', verified: true,
    reputationScore: 91, completedProjects: 6, status: 'approved', appliedAt: '2024-01-20', endorsements: 19
  },
];

const projects: FundingProject[] = [
  {
    id: 'p1', name: 'DeFi Bridge Protocol', description: 'Cross-chain bridge with instant finality and MEV protection. Supports 12+ chains with sub-second transfers.',
    category: 'Infrastructure', chain: 'Ethereum', goal: 150000, raised: 89000,
    builder: '0x7a2d...9f4e', builderName: 'Alex Chen', verified: true, daysLeft: 15,
    status: 'active', teamSize: 4, website: 'https://defibridge.io', whitepaper: 'https://defibridge.io/whitepaper.pdf',
    contractAddress: '0x1234...5678', submittedAt: '2024-06-01',
    milestones: [
      { name: 'Smart Contract Audit', description: 'Complete audit with Trail of Bits', amount: 30000, deliverables: 'Audit report, fixed vulnerabilities', status: 'completed', completedAt: '2024-07-15' },
      { name: 'Testnet Launch', description: 'Deploy on Goerli testnet with 3 chains', amount: 35000, deliverables: 'Working testnet, documentation', status: 'in_progress' },
      { name: 'Mainnet Integration', description: 'Deploy on Ethereum mainnet', amount: 40000, deliverables: 'Live contracts, integration guide', status: 'locked' },
      { name: 'Security Hardening', description: 'Bug bounty program and monitoring', amount: 25000, deliverables: 'Bug bounty setup, monitoring dashboard', status: 'locked' },
      { name: 'Public Launch', description: 'Full public launch with documentation', amount: 20000, deliverables: 'Marketing, community launch', status: 'locked' },
    ],
    investors: 34, tags: ['Bridge', 'Cross-chain', 'MEV Protection']
  },
  {
    id: 'p2', name: 'SolSwap Pro', description: 'Next-gen DEX with AI-powered routing on Solana. Best execution prices across all Solana liquidity sources.',
    category: 'DeFi', chain: 'Solana', goal: 200000, raised: 145000,
    builder: '0x3c8b...2a1f', builderName: 'Marcus Johnson', verified: true, daysLeft: 8,
    status: 'active', teamSize: 6, website: 'https://solswappro.io', whitepaper: 'https://solswappro.io/docs',
    contractAddress: 'SoLSwP...x1234', submittedAt: '2024-05-15',
    milestones: [
      { name: 'Core DEX Engine', description: 'Build aggregation engine', amount: 40000, deliverables: 'Working aggregator', status: 'completed', completedAt: '2024-06-20' },
      { name: 'AI Routing Module', description: 'ML-based route optimization', amount: 35000, deliverables: 'Routing algorithm, benchmarks', status: 'completed', completedAt: '2024-07-30' },
      { name: 'Beta Testing', description: 'Public beta with 1000 users', amount: 45000, deliverables: 'Beta app, user feedback report', status: 'completed', completedAt: '2024-08-15' },
      { name: 'Token Launch', description: 'SWAP token launch and distribution', amount: 40000, deliverables: 'Token contract, distribution plan', status: 'in_progress' },
      { name: 'Mobile App', description: 'iOS and Android apps', amount: 20000, deliverables: 'Mobile apps on stores', status: 'locked' },
      { name: 'V2 Features', description: 'Limit orders, DCA, portfolio tracking', amount: 20000, deliverables: 'Feature release', status: 'locked' },
    ],
    investors: 67, tags: ['DEX', 'AI Routing', 'Solana']
  },
  {
    id: 'p3', name: 'ChainGuard', description: 'Real-time exploit detection and prevention system. Monitors smart contracts for vulnerabilities and suspicious activity.',
    category: 'Security', chain: 'Ethereum', goal: 100000, raised: 80000,
    builder: '0x9e4f...7c3d', builderName: 'Sarah Kim', verified: true, daysLeft: 5,
    status: 'active', teamSize: 3, website: 'https://chainguard.security', whitepaper: 'https://chainguard.security/whitepaper',
    contractAddress: '0xAbCd...EfGh', submittedAt: '2024-04-20',
    milestones: [
      { name: 'Detection Engine', description: 'Core vulnerability scanner', amount: 25000, deliverables: 'Scanner binary, documentation', status: 'completed', completedAt: '2024-05-30' },
      { name: 'Real-time Monitoring', description: 'Live mempool monitoring', amount: 25000, deliverables: 'Monitoring dashboard', status: 'completed', completedAt: '2024-07-01' },
      { name: 'Alert System', description: 'Multi-channel alerts', amount: 25000, deliverables: 'Telegram/Discord/Email alerts', status: 'in_progress' },
      { name: 'Public API', description: 'Developer API for integrations', amount: 25000, deliverables: 'API docs, SDK', status: 'locked' },
    ],
    investors: 45, tags: ['Security', 'Monitoring', 'Exploit Detection']
  },
  {
    id: 'p4', name: 'DAO Governance Tool', description: 'No-code DAO creation and management platform. Create, manage, and participate in DAOs without writing code.',
    category: 'Governance', chain: 'Polygon', goal: 80000, raised: 12000,
    builder: '0xf1a2...b3c4', builderName: 'Priya Patel', verified: false, daysLeft: 42,
    status: 'active', teamSize: 2, website: 'https://daotools.xyz', whitepaper: '',
    contractAddress: '', submittedAt: '2024-08-01',
    milestones: [
      { name: 'Smart Contracts', description: 'Governance contracts on Polygon', amount: 20000, deliverables: 'Audited contracts', status: 'locked' },
      { name: 'Frontend UI', description: 'React dashboard for DAO management', amount: 25000, deliverables: 'Web app', status: 'locked' },
      { name: 'Governance Module', description: 'Proposal and voting system', amount: 20000, deliverables: 'Voting mechanism', status: 'locked' },
      { name: 'Public Launch', description: 'Launch with 10 partner DAOs', amount: 15000, deliverables: 'Live platform', status: 'locked' },
    ],
    investors: 8, tags: ['DAO', 'Governance', 'No-Code']
  },
];

const pendingApplications: BuilderApplication[] = [];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'builders';

  if (type === 'builders') {
    const statusFilter = url.searchParams.get('status') || 'approved';
    const filtered = [...builders, ...pendingApplications].filter(b =>
      statusFilter === 'all' ? true : b.status === statusFilter
    );
    return NextResponse.json({ builders: filtered }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' }
    });
  }

  if (type === 'projects') {
    const statusFilter = url.searchParams.get('status') || 'active';
    const filtered = projects.filter(p =>
      statusFilter === 'all' ? true : p.status === statusFilter
    );
    const totalRaised = projects.reduce((sum, p) => sum + p.raised, 0);
    const totalInvestors = projects.reduce((sum, p) => sum + p.investors, 0);
    return NextResponse.json({
      projects: filtered,
      stats: {
        totalRaised,
        totalProjects: projects.length,
        totalInvestors,
        activeProjects: projects.filter(p => p.status === 'active').length,
      }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' }
    });
  }

  if (type === 'pending') {
    return NextResponse.json({
      builders: pendingApplications.filter(b => b.status === 'pending'),
      projects: projects.filter(p => p.status === 'pending'),
    });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'apply_builder') {
      if (!isStr(body.name, 100) || !isStr(body.role, 100) || !isStr(body.bio, 2000) || !isStr(body.experience, 2000)) {
        return NextResponse.json({ error: 'Invalid name/role/bio/experience' }, { status: 400 });
      }
      if (!isAddr(body.walletAddress)) {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
      }
      if (!isUrlOrEmpty(body.portfolio) || !isUrlOrEmpty(body.website)) {
        return NextResponse.json({ error: 'Invalid portfolio/website URL' }, { status: 400 });
      }
      if (!isHandleOrEmpty(body.github) || !isHandleOrEmpty(body.twitter)) {
        return NextResponse.json({ error: 'Invalid github/twitter handle' }, { status: 400 });
      }
      const skills = Array.isArray(body.skills) ? body.skills.filter((s: unknown) => isStr(s, 64)).slice(0, 20) : [];
      const app: BuilderApplication = {
        id: `b_${Date.now()}`,
        name: body.name,
        role: body.role,
        skills,
        bio: body.bio,
        walletAddress: body.walletAddress,
        portfolio: body.portfolio || '',
        github: body.github || '',
        twitter: body.twitter || '',
        website: body.website || '',
        experience: body.experience,
        verified: false,
        reputationScore: 0,
        completedProjects: 0,
        status: 'pending',
        appliedAt: new Date().toISOString(),
        endorsements: 0,
      };
      pendingApplications.push(app);
      return NextResponse.json({ success: true, application: app });
    }

    if (action === 'submit_project') {
      if (!isStr(body.name, 200) || !isStr(body.description, 5000)) {
        return NextResponse.json({ error: 'Invalid name/description' }, { status: 400 });
      }
      if (!isAddr(body.walletAddress)) {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
      }
      if (!isUrlOrEmpty(body.website) || !isUrlOrEmpty(body.whitepaper)) {
        return NextResponse.json({ error: 'Invalid website/whitepaper URL' }, { status: 400 });
      }
      if (typeof body.goal !== 'number' || body.goal <= 0 || body.goal > 10_000_000) {
        return NextResponse.json({ error: 'Invalid goal amount' }, { status: 400 });
      }
      if (body.contractAddress && !isAddr(body.contractAddress)) {
        return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 });
      }
      const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => isStr(t, 32)).slice(0, 10) : [];
      const milestones = Array.isArray(body.milestones)
        ? body.milestones
            .filter((m: { name?: unknown; amount?: unknown }) => isStr(m?.name, 200) && typeof m?.amount === 'number' && m.amount > 0)
            .slice(0, 20)
        : [];
      const proj: FundingProject = {
        id: `p_${Date.now()}`,
        name: body.name,
        description: body.description,
        category: isStr(body.category, 64) ? body.category : 'DeFi',
        chain: isStr(body.chain, 32) ? body.chain : 'Ethereum',
        goal: body.goal,
        raised: 0,
        builder: body.walletAddress,
        builderName: isStrOrEmpty(body.builderName, 100) ? (body.builderName || 'Anonymous') : 'Anonymous',
        verified: false,
        daysLeft: 60,
        status: 'pending',
        teamSize: typeof body.teamSize === 'number' && body.teamSize > 0 && body.teamSize <= 100 ? body.teamSize : 1,
        website: body.website || '',
        whitepaper: body.whitepaper || '',
        contractAddress: body.contractAddress || '',
        submittedAt: new Date().toISOString(),
        milestones,
        investors: 0,
        tags,
      };
      projects.push(proj);
      return NextResponse.json({ success: true, project: proj });
    }

    if (action === 'fund_project') {
      const project = projects.find(p => p.id === body.projectId);
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const amount = Math.min(body.amount || 0, project.goal - project.raised);
      project.raised += amount;
      project.investors += 1;
      if (project.raised >= project.goal) {
        project.status = 'funded';
        project.daysLeft = 0;
      }
      return NextResponse.json({ success: true, project });
    }

    if (action === 'endorse_builder') {
      const builder = [...builders, ...pendingApplications].find(b => b.id === body.builderId);
      if (!builder) return NextResponse.json({ error: 'Builder not found' }, { status: 404 });
      builder.endorsements += 1;
      return NextResponse.json({ success: true, builder });
    }

    if (action === 'admin_approve' || action === 'admin_reject') {
      const adminId = await verifyAdminRequest(request);
      if (!adminId) return unauthorizedResponse();
      if (body.targetType === 'builder') {
        const builder = pendingApplications.find(b => b.id === body.targetId);
        if (builder) {
          builder.status = action === 'admin_approve' ? 'approved' : 'rejected';
          if (action === 'admin_approve') {
            builder.verified = true;
            builder.reputationScore = 50;
            builders.push(builder);
          }
        }
      }
      if (body.targetType === 'project') {
        const project = projects.find(p => p.id === body.targetId);
        if (project) {
          project.status = action === 'admin_approve' ? 'active' : 'rejected';
          if (action === 'admin_approve') project.verified = true;
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'approve_milestone') {
      const adminId = await verifyAdminRequest(request);
      if (!adminId) return unauthorizedResponse();
      const project = projects.find(p => p.id === body.projectId);
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const milestone = project.milestones[body.milestoneIndex];
      if (milestone) {
        milestone.status = 'completed';
        milestone.completedAt = new Date().toISOString();
        const nextMilestone = project.milestones[body.milestoneIndex + 1];
        if (nextMilestone && nextMilestone.status === 'locked') {
          nextMilestone.status = 'in_progress';
        }
      }
      return NextResponse.json({ success: true, project });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
