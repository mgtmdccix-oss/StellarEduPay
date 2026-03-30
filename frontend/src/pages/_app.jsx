import '../styles/globals.css';
import Navbar from '../components/Navbar';

export default function MyApp({ Component, pageProps }) {
  return (
    <div className="app-container">
      <Navbar />
      <main>
        <Component {...pageProps} />
      </main>
    </div>
  );
}
