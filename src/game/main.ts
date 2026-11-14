import './style.css';
import { Game } from './game';
import { installPlay } from './play';
import { Player } from './state';
import { buildUi } from './ui';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const game = new Game(canvas);
game.reset(game.seed, false);
const player = new Player();
installPlay(game, player);
const ui = buildUi(game, player, document.getElementById('ui')!);
game.start();
Object.assign(window as any, { __game: game, __player: player, __ui: ui });
