# 🎉 Luma Clone - Event Management Platform

A modern, feature-rich event management platform built with React and Supabase, inspired by Luma's clean design and user experience.

![Luma Clone Banner](https://via.placeholder.com/1200x600/1F1D2B/FFFFFF?text=Luma+Clone+-+Event+Management+Platform)

## ✨ Features

### 🎨 **Beautiful Dark Theme UI**
- Modern dark theme with carefully crafted color palette
- Responsive design that works on all devices
- Clean, intuitive interface inspired by Luma's design

### 🔐 **Authentication**
- Email/password authentication
- Google OAuth integration
- Secure user sessions with Supabase Auth

### 📅 **Event Management**
- **Create Events** with comprehensive options:
  - Public/Private visibility toggle
  - Date and time selection with validation
  - Location support (physical addresses or virtual links)
  - Rich text descriptions
  - Multiple theme options (Minimal, Colorful, Dark)
  - Real-time event name preview on cover image

### 🎫 **Event Configuration**
- **Ticketing Options**: Free or paid events
- **Approval Settings**: Require approval for attendees
- **Capacity Management**: Set limits or unlimited capacity
- **Theme Customization**: Choose from multiple visual themes

### 📋 **Event Discovery**
- Browse all public events
- Clean event cards with essential information
- Event details including date, time, location, and capacity
- Empty state with call-to-action when no events exist

### 🛠️ **Technical Features**
- **Real-time Updates**: Live data synchronization with Supabase
- **Form Validation**: Comprehensive client-side validation
- **Error Handling**: Graceful error handling and user feedback
- **Performance**: Optimized build with code splitting warnings
- **Security**: Row Level Security (RLS) with proper policies

## 🚀 Tech Stack

- **Frontend**: React 18 with Vite for fast development
- **Styling**: Plain CSS with CSS Modules (no frameworks)
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **Authentication**: Supabase Auth with Google OAuth
- **Routing**: React Router v6
- **Date Handling**: date-fns for date manipulation
- **Build Tool**: Vite for optimized builds
- **Code Quality**: ESLint for code standards

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/luma-clone.git
   cd luma-clone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   - Go to your Supabase dashboard
   - Open the SQL Editor
   - Run the contents of `database-setup.sql`

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🗄️ Database Schema

The application uses the following main tables:

### Events Table
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  is_public BOOLEAN DEFAULT true,
  is_free BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  capacity INTEGER,
  theme TEXT DEFAULT 'minimal',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Attendees Table
```sql
CREATE TABLE attendees (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run tests (Jest configured)

## 🎨 Design System

### Color Palette
- **Primary**: `#2D2B3A` (Dark purple-gray)
- **Background**: `#1F1D2B` (Dark background)
- **Surface**: `#2D2B3A` (Card backgrounds)
- **Text Primary**: `#FFFFFF` (White text)
- **Text Secondary**: `#9CA3AF` (Gray text)
- **Accent Green**: `#10B981` (Success states)
- **Accent Blue**: `#3B82F6` (Interactive elements)

### Typography
- **Font Family**: System font stack for optimal performance
- **Spacing**: 8px grid system for consistent spacing
- **Border Radius**: 8px and 12px for subtle rounded corners

## 📱 Responsive Design

The application is fully responsive and works on:
- **Desktop**: Full-featured experience
- **Tablet**: Optimized layout with stacked forms
- **Mobile**: Touch-friendly interface with mobile-first approach

## 🔒 Security

- **Row Level Security (RLS)**: Implemented on all tables
- **User Isolation**: Users can only access their own events
- **Public Events**: Proper visibility controls
- **Input Validation**: Both client and server-side validation
- **Authentication**: Secure OAuth flows

## 🚀 Deployment

The application is ready for deployment on:
- **Vercel**: Zero-config deployment
- **Netlify**: Static site hosting
- **Any static hosting**: Build outputs to `dist/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Luma**: For the design inspiration
- **Supabase**: For the excellent backend-as-a-service
- **React Team**: For the amazing framework
- **Vite**: For the fast build tool

## 📧 Contact

**Shubham** - [Your Email](mailto:your.email@example.com)

Project Link: [https://github.com/yourusername/luma-clone](https://github.com/yourusername/luma-clone)

---

Built with ❤️ using React, Supabase, and modern web technologies.
