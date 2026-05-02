/*
  Vale Chess Local Engine - fallback compativel com Chess()
  Implementa regras principais do xadrez offline para evitar falha de CDN.
*/
(function(global){
  const FILES = "abcdefgh";
  const START = [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"]
  ];
  function cloneBoard(b){ return b.map(row => row.map(p => p ? {...p} : null)); }
  function sq(f,r){ return FILES[f] + (8-r); }
  function coords(s){ return { f: FILES.indexOf(s[0]), r: 8 - parseInt(s[1],10) }; }
  function inb(f,r){ return f>=0 && f<8 && r>=0 && r<8; }
  function opp(c){ return c === "w" ? "b" : "w"; }
  function makePiece(ch){ return ch ? { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "w" : "b" } : null; }
  function pieceChar(p){ if(!p) return "1"; const c = p.type; return p.color === "w" ? c.toUpperCase() : c; }

  class Chess {
    constructor(){ this.reset(); }
    reset(){
      this._board = START.map(row => row.map(makePiece));
      this._turn = "w";
      this._history = [];
      this._kingsMoved = {w:false,b:false};
      this._rookMoved = {w:{a:false,h:false}, b:{a:false,h:false}};
      this._ep = null;
    }
    board(){ return cloneBoard(this._board); }
    turn(){ return this._turn; }
    fen(){
      const rows = this._board.map(row => {
        let out="", empty=0;
        for(const p of row){
          if(!p){ empty++; continue; }
          if(empty){ out += empty; empty = 0; }
          out += pieceChar(p);
        }
        if(empty) out += empty;
        return out;
      });
      return rows.join("/") + " " + this._turn + " - " + (this._ep || "-") + " 0 1";
    }
    get(square){
      const c = coords(square);
      if(!inb(c.f,c.r)) return null;
      const p = this._board[c.r][c.f];
      return p ? {...p} : null;
    }
    moves(opts={}){
      const square = opts.square || null;
      const verbose = !!opts.verbose;
      let out = [];
      for(let r=0;r<8;r++){
        for(let f=0;f<8;f++){
          const p = this._board[r][f];
          if(!p || p.color !== this._turn) continue;
          const from = sq(f,r);
          if(square && from !== square) continue;
          out.push(...this._pseudo(from, true));
        }
      }
      out = out.filter(m => this._legalAfter(m));
      return verbose ? out.map(m => ({...m, san:this._san(m)})) : out.map(m => this._san(m));
    }
    move(input){
      const from = input.from, to = input.to, promotion = input.promotion || "q";
      const legal = this.moves({square:from, verbose:true}).find(m => m.to === to);
      if(!legal) return null;
      const a = coords(from), b = coords(to);
      const piece = this._board[a.r][a.f];
      const captured = this._board[b.r][b.f];
      const beforeEp = this._ep;
      this._ep = null;

      if(piece.type === "k"){
        this._kingsMoved[piece.color] = true;
        if(Math.abs(b.f-a.f) === 2){
          if(b.f === 6){ this._board[b.r][5] = this._board[b.r][7]; this._board[b.r][7] = null; }
          if(b.f === 2){ this._board[b.r][3] = this._board[b.r][0]; this._board[b.r][0] = null; }
        }
      }
      if(piece.type === "r"){
        if(a.f === 0) this._rookMoved[piece.color].a = true;
        if(a.f === 7) this._rookMoved[piece.color].h = true;
      }
      if(piece.type === "p" && Math.abs(b.r-a.r) === 2) this._ep = sq(a.f, (a.r+b.r)/2);

      let epCaptured = null;
      if(piece.type === "p" && beforeEp === to && !captured && a.f !== b.f){
        const capR = piece.color === "w" ? b.r+1 : b.r-1;
        epCaptured = this._board[capR][b.f];
        this._board[capR][b.f] = null;
      }

      this._board[b.r][b.f] = {...piece};
      this._board[a.r][a.f] = null;
      if(piece.type === "p" && (b.r === 0 || b.r === 7)) this._board[b.r][b.f].type = promotion;

      const result = {
        color: piece.color, from, to, piece: piece.type,
        captured: captured ? captured.type : (epCaptured ? epCaptured.type : undefined),
        promotion: (piece.type==="p" && (b.r===0||b.r===7)) ? promotion : undefined
      };
      result.san = this._san(result);
      this._history.push(result);
      this._turn = opp(this._turn);
      return result;
    }
    game_over(){ return this.in_checkmate() || this.in_draw(); }
    in_check(){ return this._inCheck(this._turn); }
    in_checkmate(){ return this.in_check() && this.moves({verbose:true}).length === 0; }
    in_draw(){ return !this.in_check() && this.moves({verbose:true}).length === 0; }
    isGameOver(){ return this.game_over(); }
    isCheck(){ return this.in_check(); }
    isCheckmate(){ return this.in_checkmate(); }
    isDraw(){ return this.in_draw(); }

    _pseudo(from, includeCastling=false){
      const {f,r} = coords(from);
      const p = this._board[r][f];
      if(!p) return [];
      const res = [];
      const add = (tf,tr,extra={}) => {
        if(!inb(tf,tr)) return false;
        const target = this._board[tr][tf];
        if(target && target.color === p.color) return false;
        res.push({ color:p.color, from, to:sq(tf,tr), piece:p.type, captured:target?target.type:undefined, ...extra });
        return !target;
      };
      if(p.type === "p"){
        const dir = p.color === "w" ? -1 : 1;
        const startR = p.color === "w" ? 6 : 1;
        const one = r + dir;
        if(inb(f,one) && !this._board[one][f]){
          add(f,one, (one===0||one===7)?{promotion:"q"}:{});
          const two = r + 2*dir;
          if(r === startR && !this._board[two][f]) add(f,two);
        }
        for(const df of [-1,1]){
          const tf=f+df, tr=r+dir;
          if(!inb(tf,tr)) continue;
          const target = this._board[tr][tf];
          if(target && target.color !== p.color) add(tf,tr, (tr===0||tr===7)?{promotion:"q"}:{});
          if(this._ep === sq(tf,tr)) res.push({color:p.color, from, to:sq(tf,tr), piece:"p", captured:"p"});
        }
      } else if(p.type === "n"){
        [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(d=>add(f+d[0],r+d[1]));
      } else if(p.type === "b" || p.type === "r" || p.type === "q"){
        const dirs = [];
        if(p.type === "b" || p.type === "q") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
        if(p.type === "r" || p.type === "q") dirs.push([1,0],[-1,0],[0,1],[0,-1]);
        for(const [df,dr] of dirs){
          let tf=f+df,tr=r+dr;
          while(inb(tf,tr)){
            if(!add(tf,tr)) break;
            tf += df; tr += dr;
          }
        }
      } else if(p.type === "k"){
        for(let df=-1;df<=1;df++) for(let dr=-1;dr<=1;dr++) if(df||dr) add(f+df,r+dr);
        if(includeCastling && !this._kingsMoved[p.color] && !this._inCheck(p.color)){
          const rank = p.color === "w" ? 7 : 0;
          if(r === rank && f === 4){
            if(!this._rookMoved[p.color].h && !this._board[rank][5] && !this._board[rank][6] && !this._attacked(5,rank,opp(p.color)) && !this._attacked(6,rank,opp(p.color))) add(6,rank,{castle:"k"});
            if(!this._rookMoved[p.color].a && !this._board[rank][1] && !this._board[rank][2] && !this._board[rank][3] && !this._attacked(3,rank,opp(p.color)) && !this._attacked(2,rank,opp(p.color))) add(2,rank,{castle:"q"});
          }
        }
      }
      return res;
    }
    _legalAfter(m){
      const backup = cloneBoard(this._board), ep = this._ep;
      const a = coords(m.from), b = coords(m.to);
      const p = this._board[a.r][a.f];
      if(!p) return false;
      if(p.type === "p" && ep === m.to && !this._board[b.r][b.f] && a.f !== b.f){
        const capR = p.color === "w" ? b.r+1 : b.r-1;
        this._board[capR][b.f] = null;
      }
      this._board[b.r][b.f] = {...p};
      this._board[a.r][a.f] = null;
      if(p.type === "p" && (b.r===0||b.r===7)) this._board[b.r][b.f].type = "q";
      const bad = this._inCheck(p.color);
      this._board = backup; this._ep = ep;
      return !bad;
    }
    _inCheck(color){
      let kf=-1, kr=-1;
      for(let r=0;r<8;r++) for(let f=0;f<8;f++){
        const p=this._board[r][f];
        if(p && p.type==="k" && p.color===color){ kf=f; kr=r; }
      }
      if(kf < 0) return false;
      return this._attacked(kf,kr,opp(color));
    }
    _attacked(f,r,byColor){
      for(let rr=0; rr<8; rr++) for(let ff=0; ff<8; ff++){
        const p = this._board[rr][ff];
        if(!p || p.color !== byColor) continue;
        const df = f-ff, dr = r-rr;
        if(p.type === "p"){
          const dir = p.color === "w" ? -1 : 1;
          if(dr === dir && Math.abs(df) === 1) return true;
        } else if(p.type === "n"){
          if((Math.abs(df)===1 && Math.abs(dr)===2) || (Math.abs(df)===2 && Math.abs(dr)===1)) return true;
        } else if(p.type === "k"){
          if(Math.max(Math.abs(df), Math.abs(dr)) === 1) return true;
        } else {
          const dirs = [];
          if(p.type === "b" || p.type === "q") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
          if(p.type === "r" || p.type === "q") dirs.push([1,0],[-1,0],[0,1],[0,-1]);
          for(const [sx,sy] of dirs){
            let tf=ff+sx,tr=rr+sy;
            while(inb(tf,tr)){
              if(tf===f && tr===r) return true;
              if(this._board[tr][tf]) break;
              tf+=sx; tr+=sy;
            }
          }
        }
      }
      return false;
    }
    _san(m){
      if(m.castle === "k") return "O-O";
      if(m.castle === "q") return "O-O-O";
      const names = {p:"",n:"N",b:"B",r:"R",q:"Q",k:"K"};
      const capture = m.captured ? "x" : "";
      const fromFile = m.piece === "p" && capture ? m.from[0] : "";
      let san = names[m.piece] + fromFile + capture + m.to;
      if(m.promotion) san += "=" + m.promotion.toUpperCase();
      return san;
    }
  }
  global.Chess = global.Chess || Chess;
  global.ValeLocalChess = Chess;
})(window);
