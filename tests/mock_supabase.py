"""Imita el contrato REST/RPC de Supabase para probar el cliente del juego.
Replica la semantica de las funciones SQL ya verificadas contra el Supabase real:
hash del token, upsert por hash, lectura solo del propio token y marcador publico.
"""
import http.server, json, hashlib, threading, time

SAVES = {}          # token_hash -> {data, day, kills, updated_at}
RECORDS = []        # {token_hash, name, days, kills, won, created_at}
KEY = 'sb_publishable_xmV__n15r7eOTv0NL3MtEQ_a-or8SRd'

def h(tok): return hashlib.sha256((tok or '').encode()).hexdigest()

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, code, payload):
        b = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST,OPTIONS')
        self.end_headers()

    def do_POST(self):
        # exige la apikey, como Supabase
        if self.headers.get('apikey') != KEY:
            return self._send(401, {'message': 'No API key found in request'})
        n = int(self.headers.get('Content-Length') or 0)
        args = json.loads(self.rfile.read(n) or b'{}')
        fn = self.path.rsplit('/', 1)[-1]

        if fn == 'zc_save_put':
            tok = args.get('p_token') or ''
            if len(tok) < 16:
                return self._send(400, {'message': 'token invalido'})
            now = time.strftime('%Y-%m-%dT%H:%M:%SZ')
            SAVES[h(tok)] = {'data': args.get('p_data'), 'day': args.get('p_day', 1),
                             'kills': args.get('p_kills', 0), 'updated_at': now}
            return self._send(200, now)

        if fn == 'zc_save_get':
            tok = args.get('p_token') or ''
            if len(tok) < 16:
                return self._send(400, {'message': 'token invalido'})
            row = SAVES.get(h(tok))
            return self._send(200, [row] if row else [])

        if fn == 'zc_save_delete':
            SAVES.pop(h(args.get('p_token') or ''), None)
            return self._send(200, None)

        if fn == 'zc_record_add':
            tok = args.get('p_token') or ''
            if len(tok) < 16:
                return self._send(400, {'message': 'token invalido'})
            RECORDS.append({'token_hash': h(tok),
                            'name': (args.get('p_name') or 'Superviviente')[:24],
                            'days': max(args.get('p_days') or 1, 0),
                            'kills': max(args.get('p_kills') or 0, 0),
                            'won': bool(args.get('p_won')),
                            'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ')})
            return self._send(200, None)

        if fn == 'zc_record_top':
            lim = min(max(args.get('p_limit') or 20, 1), 50)
            rows = sorted(RECORDS, key=lambda r: (-r['days'], -r['kills'], r['created_at']))[:lim]
            # el marcador NUNCA expone el token, igual que la funcion SQL
            return self._send(200, [{k: r[k] for k in ('name', 'days', 'kills', 'won', 'created_at')}
                                    for r in rows])

        return self._send(404, {'message': 'not found'})

if __name__ == '__main__':
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8199), H)
    srv.serve_forever()
