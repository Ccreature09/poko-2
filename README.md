# POKO - Education Management System

A modern, comprehensive education management platform designed specifically for Bulgarian schools. POKO streamlines administrative tasks, enhances communication between stakeholders, and provides powerful tools for managing the educational process.

## 🎯 Overview

POKO is a Progressive Web Application (PWA) built with Next.js that serves as a complete education management solution. It supports multiple user roles including administrators, teachers, students, and parents, providing each with tailored dashboards and functionality.

## ✨ Key Features

### 📚 **Course Management**
- Create, update, and manage courses and curricula
- Assign teachers to subjects and classes
- Track course progress and materials

### 👥 **Student Information System**
- Detailed student profiles and academic records
- Attendance tracking and reporting
- Grade management and progress monitoring

### 📅 **Timetable Management**
- Intuitive schedule creation and management
- Class scheduling with conflict detection
- Real-time updates and notifications

### 📊 **Analytics & Reporting**
- Comprehensive analytics and reports
- Academic performance insights
- Attendance statistics and trends

### 💬 **Communication System**
- Built-in messaging between all stakeholders
- Notifications and announcements
- Parent-teacher communication tools

### 📱 **Multi-Role Dashboards**
- **Admin**: Complete school management and oversight
- **Teacher**: Class management, grading, and communication
- **Student**: Course access, assignments, and progress tracking
- **Parent**: Child's progress monitoring and school communication

## 🛠️ Technology Stack

- **Frontend**: Next.js 15.2.0 with React 19
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Firebase (Firestore)
- **Authentication**: Firebase Auth
- **PWA**: Next-PWA for offline capability
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Type Safety**: TypeScript

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Firebase project setup

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/poko-2.git
   cd poko-2
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory and add your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

5. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
poko-2/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard and management
│   ├── teacher/           # Teacher portal
│   ├── student/           # Student interface
│   ├── parent/            # Parent portal
│   └── api/               # API routes
├── components/            # Reusable UI components
│   ├── ui/                # Base UI components (shadcn/ui)
│   └── functional/        # Application-specific components
├── contexts/              # React context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and configurations
└── public/                # Static assets and PWA files
```

## 🔑 User Roles & Access

### 🏫 **Administrator**
- Complete school management
- User management (teachers, students, parents)
- Course and class setup
- System configuration

### 👨‍🏫 **Teacher**
- Class management
- Grade entry and assessment
- Attendance tracking
- Student communication

### 🎓 **Student**
- Course access and materials
- Assignment submission
- Grade viewing
- Schedule access

### 👨‍👩‍👧‍👦 **Parent**
- Child's academic progress
- Attendance monitoring
- Teacher communication
- School announcements

## 📱 PWA Features

POKO is a Progressive Web Application offering:
- **Offline functionality** - Core features work without internet
- **Install on device** - Add to home screen on mobile/desktop
- **Push notifications** - Real-time updates and alerts
- **Responsive design** - Optimized for all screen sizes

## 🔧 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality

## 🌐 Deployment

### Vercel (Recommended)
The easiest way to deploy POKO is using the [Vercel Platform](https://vercel.com/new):

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on every push

### Other Platforms
POKO can be deployed on any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [documentation](docs/)
- Contact the development team

## 🔮 Roadmap

- [ ] Multi-language support
- [ ] Advanced reporting features
- [ ] Mobile app development
- [ ] Integration with external systems
- [ ] AI-powered insights

---

**POKO** - Transforming education management for Bulgarian schools 🇧🇬
