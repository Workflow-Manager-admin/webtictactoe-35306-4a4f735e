import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Backend base URL (update according to deployment/proxy/host)
const BACKEND_BASE_URL =
  process.env.REACT_APP_TIC_TAC_TOE_BACKEND_URL ||
  'http://localhost:3001';

function fetchApi(endpoint, method = "GET", body = null, token = null) {
  // PUBLIC_INTERFACE
  // A lightweight backend API fetch helper.
  let opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BACKEND_BASE_URL}${endpoint}`, opts).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });
}

// PUBLIC_INTERFACE
function LoginView({ onLogin, loading }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      className="center-col"
      style={{ gap: 12, padding: 24, marginTop: 60, background: 'var(--bg-secondary)', borderRadius: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim()) {
          setError('Enter your username');
          return;
        }
        onLogin(username.trim()).catch(e => setError(e.message || "Login failed"));
      }}
    >
      <div style={{ paddingBottom: 12 }}>
        <span className="ttt-title">Welcome to Tic Tac Toe!</span>
      </div>
      <label htmlFor="user" className="ttt-label">Enter Username to Play</label>
      <input
        type="text"
        id="user"
        value={username}
        autoFocus
        autoComplete="off"
        disabled={loading}
        style={{ padding: 8, fontSize: 16, borderRadius: 6, border: "1px solid var(--border-color)" }}
        onChange={e => setUsername(e.target.value)}
        maxLength={16}
        required
      />
      <button className="ttt-btn" type="submit" disabled={loading}>
        {loading ? "Logging in..." : "Play"}
      </button>
      {error && <span className="ttt-error">{error}</span>}
    </form>
  );
}

// PUBLIC_INTERFACE
function Board({ board, onMove, yourTurn, disabled, winner, highlight, }) {
  // Render a 3x3 tic-tac-toe board.
  return (
    <div className="ttt-board">
      {board.map((val, idx) => {
        const isWin = highlight && highlight.includes(idx);
        return (
          <button
            className={`ttt-cell${isWin ? ' ttt-cell-win' : ''}`}
            key={idx}
            aria-label={`cell-${idx}`}
            disabled={val !== null || disabled || !yourTurn}
            style={{
              color: val === 'X' ? 'var(--primary)' : val === 'O' ? 'var(--secondary)' : undefined,
              cursor: val || disabled || !yourTurn ? 'default' : 'pointer',
            }}
            onClick={() => onMove(idx)}
          >
            {val || ''}
          </button>
        );
      })}
    </div>
  );
}

// PUBLIC_INTERFACE
function GameInfoBar({ info, onNewGame, newGameDisabled }) {
  // Shows the info message and new game button.
  return (
    <div className="ttt-info-bar">
      <span className="ttt-game-message">{info}</span>
      <button className="ttt-btn ttt-btn-sm" onClick={onNewGame} disabled={newGameDisabled}>
        New Game
      </button>
    </div>
  );
}

// PUBLIC_INTERFACE
function GameHistory({ games, activeId, onSelect }) {
  // Show a vertical, recent-first list of games.
  return (
    <div className="ttt-history-section">
      <div className="ttt-history-title">Game History</div>
      <ul className="ttt-history-list">
        {games.length === 0 && <li style={{ color: "var(--text-secondary)" }}>No games played yet.</li>}
        {games.map((g, idx) => (
          <li
            key={g.id}
            className={`ttt-history-item${g.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(g.id)}
            title={`Started: ${new Date(g.started_at).toLocaleString()}`}
          >
            <span>{new Date(g.started_at).toLocaleTimeString()} - {g.winner ? `Winner: ${g.winner}` : g.status === 'active' ? 'In Progress' : 'Draw'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// PUBLIC_INTERFACE
function TicTacToeGame({ user, token, onLogout }) {
  // Real-time/game state logic.
  const [board, setBoard] = useState(Array(9).fill(null));
  const [yourTurn, setYourTurn] = useState(false);
  const [msg, setMsg] = useState('');
  const [winner, setWinner] = useState(null);
  const [highlight, setHighlight] = useState([]);
  const [gameId, setGameId] = useState(null);
  const [history, setHistory] = useState([]);
  const [gameLoading, setGameLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const pollRef = useRef();

  // Helper to poll backend for live updates
  function pollGameState(gId, stopIfDone = true) {
    if (!gId) return;
    pollRef.current && clearTimeout(pollRef.current);
    fetchApi(`/games/${gId}`, 'GET', null, token)
      .then(game => {
        setBoard(game.board);
        setWinner(game.winner);
        setHighlight(game.winning_cells || []);
        setYourTurn(game.next === user && !game.winner && !game.draw);
        if (game.winner) {
          setMsg(game.winner === user ? "You win! 🎉" : `Player "${game.winner}" wins.`);
        } else if (game.draw) {
          setMsg("Draw! 🤝");
        } else {
          setMsg(game.next === user ? "Your turn" : `Waiting for "${game.next}"...`);
        }
        if ((game.winner || game.draw) && stopIfDone) return; // Don't poll anymore
        pollRef.current = setTimeout(() => pollGameState(gId, stopIfDone), 2200);
      })
      .catch(() => setMsg('Game not found or backend unavailable'));
  }

  // On mount/fetch active or last game
  useEffect(() => {
    setGameLoading(true);
    fetchApi("/games/active_or_new", 'POST', { username: user }, token).then(g => {
      setGameId(g.id);
      setGameLoading(false);
      setRefreshCount(c => c + 1); // trigger game state fetch
    });
    // fetch history
    fetchApi(`/users/${user}/games`, 'GET', null, token).then(hist => setHistory(hist));
    // Clean up poll timer on unmount
    return () => pollRef.current && clearTimeout(pollRef.current);
    // eslint-disable-next-line
  }, []);

  // Whenever gameId or refreshCount changes, fetch state & (re-)establish polling
  useEffect(() => {
    if (!gameId) return;
    pollGameState(gameId);
    // Clean up
    return () => pollRef.current && clearTimeout(pollRef.current);
    // eslint-disable-next-line
  }, [gameId, refreshCount]);

  // PUBLIC_INTERFACE
  function handleMove(idx) {
    if (winner || board[idx] != null || !yourTurn) return;
    fetchApi(`/games/${gameId}/move`, 'POST', { index: idx, username: user }, token)
      .then(game => {
        setBoard(game.board);
        setWinner(game.winner);
        setHighlight(game.winning_cells || []);
        setYourTurn(game.next === user && !game.winner && !game.draw);
        if (game.winner)
          setMsg(game.winner === user ? "You win! 🎉" : `Player "${game.winner}" wins.`);
        else if (game.draw)
          setMsg("Draw! 🤝");
        else
          setMsg(game.next === user ? "Your turn" : `Waiting for "${game.next}"...`);
        setRefreshCount(c => c + 1);
      })
      .catch(e => setMsg(e.message || 'Invalid move'));
  }

  // PUBLIC_INTERFACE
  function startNewGame() {
    setGameLoading(true);
    fetchApi("/games/new", 'POST', { username: user }, token)
      .then(game => {
        setGameId(game.id);
        setBoard(Array(9).fill(null));
        setWinner(null);
        setHighlight([]);
        setGameLoading(false);
        setRefreshCount(c => c + 1);
        fetchApi(`/users/${user}/games`, 'GET', null, token).then(hist => setHistory(hist));
      });
  }

  // PUBLIC_INTERFACE
  function selectHistoryGame(gId) {
    setGameId(gId);
    setWinner(null);
    setHighlight([]);
    setRefreshCount(c => c + 1);
  }

  return (
    <div className="center-col" style={{ gap: 12, alignItems: "center", paddingBottom: 40 }}>
      <div className="ttt-header-row">
        <span className="ttt-title">Tic Tac Toe</span>
        <span className="ttt-username">Hi, {user}</span>
        <button className="ttt-btn ttt-btn-sm" onClick={onLogout}>Logout</button>
      </div>
      <div style={{ display: "flex", gap: 36, justifyContent: "center", width: "100%" }}>
        <div>
          <Board
            board={board}
            onMove={handleMove}
            yourTurn={yourTurn}
            disabled={gameLoading || !!winner}
            winner={winner}
            highlight={highlight}
          />
          <GameInfoBar info={msg || "Loading..."} onNewGame={startNewGame} newGameDisabled={gameLoading} />
        </div>
        <GameHistory games={history} activeId={gameId} onSelect={selectHistoryGame} />
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  // Global theme state retained from template, plus user/session state.
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(() => localStorage.getItem('username') || '');
  const [token, setToken] = useState(() => localStorage.getItem('user_token') || '');
  const [loading, setLoading] = useState(false);

  // Set theme on initial render and when changed.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function logoutUser() {
    localStorage.removeItem("username");
    localStorage.removeItem("user_token");
    setUser("");
    setToken("");
  }

  // PUBLIC_INTERFACE
  async function loginUser(username) {
    setLoading(true);
    const resp = await fetchApi('/login', 'POST', { username });
    if (resp && resp.username) {
      setUser(resp.username);
      setToken(resp.token || '');
      localStorage.setItem('username', resp.username);
      if (resp.token) localStorage.setItem('user_token', resp.token);
      setLoading(false);
    } else {
      setLoading(false);
      throw new Error('Login failed');
    }
  }

  return (
    <div className="App">
      <header className="App-header" style={{ minHeight: "unset", padding: 0 }}>
        <button
          className="theme-toggle"
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        {!user ? (
          <LoginView onLogin={loginUser} loading={loading} />
        ) : (
          <TicTacToeGame user={user} token={token} onLogout={logoutUser} />
        )}
        <footer style={{ marginTop: 42, color: 'var(--text-secondary)', fontSize: 14 }}>
          Powered by KAVIA ·{' '}
          <a href="https://reactjs.org/" style={{ color: 'var(--text-secondary)' }}>React</a>
        </footer>
      </header>
    </div>
  );
}

export default App;
