import './style.css';
import { Game } from './game';
import { installPlay } from './play';
import { Player } from './state';
import { installTalk } from './talk';
import { buildUi } from './ui';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const game = new Game(canvas);
game.reset(game.seed, false);
const player = new Player();
installPlay(game, player);
const ui = buildUi(game, player, document.getElementById('ui')!);
const talk = installTalk(game, player, ui);
game.start();
Object.assign(window as any, { __game: game, __player: player, __ui: ui, __talk: talk });
