import { connection } from '../utils/connection';
import { GameCards } from './GameCards';

type id = string | number;

class GameState {
    private constructor() {}

    public static async init(gid: id) {
        await connection.none(
            `
            INSERT INTO "State"(gid, started)
            VALUES ($1, FALSE);
        `,
            [gid]
        );
    }

    public static async start(gid: id) {
        const hasGameStarted = await this.gameHasStarted(gid);
        if(hasGameStarted){
            return;
        }
        
        const firstPlayer = await connection.one(`
            SELECT uid
            FROM "GameUser"
            WHERE gid = $1
            ORDER BY time_joined
            LIMIT 1;
        `,[gid]);

        await connection.none(
            `
            UPDATE "State"
            SET current_turn = $1, started = TRUE
            WHERE gid = $2
        `,
            [firstPlayer.uid, gid]
        );
    }

    public static async isUsersTurn(uid: id, gid: id){
        const user = await connection.one(`
            SELECT current_turn
            FROM "State"
            WHERE gid = $1;
        `,[gid]);
        
        return uid == user.current_turn;
    }

    public static async getGameState(gid: id) {
        const state = await connection.one(
            `
            SELECT s.started, s.current_turn, s.modifier, u.username, u.uid, l.val, l.color, l.lid
            FROM "State" s
            LEFT JOIN "User" u
            ON s.current_turn = u.uid
            LEFT JOIN "Lookup" l
            ON s.last_card_played = l.lid
            WHERE gid = $1;
        `,
            [gid]
        );

        let cardPlayed = null;
        if (state.val && state.color) {
            cardPlayed = GameCards.formatCard(state.color, state.val);
        }

        return {
            started: state.started,
            lastCardPlayed: cardPlayed,
            lastCardId: state.lid,
            username: state.username,
            uid: state.uid,
            currentTurn: state.current_turn,
            modifier: state.modifier,
        };
    }


    public static async getCurrentTurnMod(gameId: id) {
        const state = await connection.one(
            `
            SELECT current_turn, modifier
            FROM "State"
            WHERE gid=$1;
        `,
            [gameId]
        );

        return {
            modifier: state.modifier,
            currentTurn: state.current_turn,
        };
    }

    public static async getLastCardPlayed(gameId: id){
        const state = await connection.oneOrNone(`
            SELECT l.val, l.color, l.lid
            FROM "State" s, "Lookup" l
            WHERE s.last_card_played = l.lid and s.gid = $1;
        `,[gameId]);

        if(state){
            return ({
                color: state.color,
                value: state.val,
                ref: state.lid
            })
        }
        return null;
    }

    public static async updateCurrentTurn(currentUser: id, gameId: id) {
        await connection.none(
            `
            UPDATE "State"
            SET current_turn = $1
            WHERE gid=$2;
        `,
            [currentUser, gameId]
        );
    }

    public static async updateModifier(modifier: string|null, gameId: id) {
        await connection.none(
            `
            UPDATE "State"
            SET modifier = $1
            WHERE gid=$2
        `,
            [modifier, gameId]
        );
    }

    public static async gameHasStarted(gid: id){
        const hasStarted = await connection.one(`
            SELECT started
            FROM "State"
            WHERE gid=$1;        
        `,[gid]);

        return hasStarted.started;
    }

    public static async toggleReverse(gid: id){
        const mod = await connection.oneOrNone(`
            SELECT modifier
            FROM "State"
            WHERE gid = $1;
        `,[gid])

        if(!mod || mod.modifier === "reverse"){
            await this.updateModifier(null, gid);
        }else{
            await this.updateModifier("reverse", gid);
        }
    }
}

export { GameState };
