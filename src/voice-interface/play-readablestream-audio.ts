import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class AudioPlayer {
    private audioStream: NodeJS.ReadableStream;
    private afplayProcess: ChildProcessWithoutNullStreams | null;
    private playing: boolean;
    private closed: boolean;
    private tempFilePath: string | null;

    /**
     * Cria uma instância do AudioPlayer.
     *
     * @param {NodeJS.ReadableStream} audioStream O ReadableStream contendo os dados do áudio.
     */
    constructor(audioStream: NodeJS.ReadableStream) {
        this.audioStream = audioStream;
        this.afplayProcess = null;
        this.playing = false;
        this.closed = false;
        this.tempFilePath = null;

        // Garante que o stream seja pausado inicialmente para controle manual
        this.audioStream.pause();

        // Lida com o final do stream para finalizar o processo afplay
        this.audioStream.on('end', () => {
            if (this.afplayProcess && !this.afplayProcess.killed) {
                this.afplayProcess.kill();
                this.playing = false;
            }
            this.closed = true;
        });

        this.audioStream.on('error', (err: Error) => {
            console.error('Erro no stream de áudio:', err);
            this.cancel();
        });
    }

    /**
     * Salva o stream de áudio em um arquivo temporário.
     * 
     * @returns {Promise<string>} Caminho do arquivo temporário
     */
    private async saveToTempFile(): Promise<string> {
        return new Promise((resolve, reject) => {
            // Cria um nome de arquivo único baseado em timestamp e valor aleatório
            const randomSuffix = crypto.randomBytes(8).toString('hex');
            const tempFilePath = path.join('/tmp', `audio-${Date.now()}-${randomSuffix}.raw`);
            
            const fileStream = fs.createWriteStream(tempFilePath);
            
            fileStream.on('finish', () => {
                this.tempFilePath = tempFilePath;
                resolve(tempFilePath);
            });
            
            fileStream.on('error', (err) => {
                reject(err);
            });
            
            // Pipe o stream de áudio para o arquivo
            this.audioStream.pipe(fileStream);
            this.audioStream.resume();
        });
    }

    /**
     * Remove o arquivo temporário se ele existir.
     */
    private cleanupTempFile() {
        if (this.tempFilePath && fs.existsSync(this.tempFilePath)) {
            try {
                fs.unlinkSync(this.tempFilePath);
                console.log(`Arquivo temporário removido: ${this.tempFilePath}`);
                this.tempFilePath = null;
            } catch (err) {
                console.error('Erro ao remover arquivo temporário:', err);
            }
        }
    }

    /**
     * Inicia a reprodução do áudio usando afplay.
     *
     * @returns {Promise<void>} Uma Promise que resolve quando a reprodução termina
     * ou rejeita com um erro se houver falha.
     */
    async play() {
        return new Promise<void>(async (resolve, reject) => {
            if (this.playing) {
                return reject(new Error('A reprodução já está em andamento.'));
            }
            if (this.closed) {
                return reject(new Error('O stream já foi encerrado.'));
            }

            try {
                // Salva o stream em um arquivo temporário
                const tempFilePath = await this.saveToTempFile();
                
                // Inicia o afplay com o arquivo temporário
                this.afplayProcess = spawn('afplay', [tempFilePath]);
                this.playing = true;

                this.afplayProcess.stdout.on('data', (data: Buffer) => {
                    console.log(`afplay stdout: ${data}`);
                });

                this.afplayProcess.stderr.on('data', (data: Buffer) => {
                    console.error(`afplay stderr: ${data}`);
                });

                this.afplayProcess.on('close', (code: number | null) => {
                    console.log(`Processo afplay finalizado com código ${code}`);
                    this.afplayProcess = null;
                    this.playing = false;
                    // Limpa o arquivo temporário após a reprodução
                    this.cleanupTempFile();
                    resolve();
                });

                this.afplayProcess.on('error', (err: Error) => {
                    console.error('Erro ao iniciar o processo afplay:', err);
                    this.afplayProcess = null;
                    this.playing = false;
                    // Limpa o arquivo temporário em caso de erro
                    this.cleanupTempFile();
                    reject(err);
                });
            } catch (error) {
                this.playing = false;
                this.cleanupTempFile();
                reject(error);
            }
        });
    }

    /**
     * Cancela a reprodução do áudio, finalizando o processo afplay.
     *
     * @returns {boolean} Retorna true se o processo foi cancelado, false se não estava em execução.
     */
    cancel() {
        if (this.afplayProcess && !this.afplayProcess.killed) {
            this.afplayProcess.kill();
            this.afplayProcess = null;
            this.playing = false;
        }
        // Limpa o arquivo temporário ao cancelar
        this.cleanupTempFile();
    }
}