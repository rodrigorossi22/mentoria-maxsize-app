document.addEventListener(\'DOMContentLoaded\', function () {\n    const API_URL = \'/api\';\n    let currentMentoradoId = null;\n    let allHabilidades = [];\n    let allSessaoDataMap = new Map(); // Usar um Map para facilitar o acesso aos dados da sessão pelo ID do container (ex: inicial-content)

    // Navigation Elements
    const navLinks = document.querySelectorAll(\'nav#session-nav ul li a\');
    const sessionContainers = document.querySelectorAll(\'main#session-content .session-form-container\');

    function showSession(targetSessionId) { // targetSessionId é o valor de data-session, ex: \'inicial\', \'sessao1\'
        sessionContainers.forEach(container => {
            container.classList.remove(\'active-session\');
        });
        navLinks.forEach(link => {
            link.classList.remove(\'active-link\');
        });

        const activeContainer = document.getElementById(targetSessionId + \'-content\');
        if (activeContainer) {
            activeContainer.classList.add(\'active-session\');
            const activeLink = document.querySelector(`nav#session-nav a[data-session="${targetSessionId}"]`);
            if (activeLink) {
                activeLink.classList.add(\'active-link\');
            }

            // Carregar e popular dados da sessão se ainda não foi feito ou se necessário
            // A lógica de carregar dados específicos da sessão ao clicar na aba já está no loadMentoradoData
            // que chama populateSessionForm para a sessão ativa inicial e as outras são preenchidas sob demanda.
            // A função populateSessionForm agora será chamada aqui se os dados já estiverem em allSessaoDataMap
            // e o container não tiver sido renderizado.
            const dbSessionId = activeContainer.dataset.sessionId; // ID da sessão no banco de dados
            if (dbSessionId && allSessaoDataMap.has(dbSessionId) && !activeContainer.dataset.rendered) {
                populateSessionForm(activeContainer, allSessaoDataMap.get(dbSessionId));
                activeContainer.dataset.rendered = \'true\';
            }
        } else {
            console.error(\'Container da sessão não encontrado:\', targetSessionId + \'-content\');
        }
    }

    navLinks.forEach(link => {
        link.addEventListener(\'click\', function (e) {
            e.preventDefault();
            const sessionName = this.getAttribute(\'data-session\');
            showSession(sessionName);
        });
    });

    async function initializePage() {
        try {
            let response = await fetch(`${API_URL}/mentorado/1`);
            if (response.ok) {
                currentMentoradoId = 1;
            } else if (response.status === 404) {
                const createResponse = await fetch(`${API_URL}/mentorado`, {
                    method: \'POST\',
                    headers: { \'Content-Type\': \'application/json\', \'Accept\': \'application/json\'},                    
                    body: JSON.stringify({ nome: \'Novo Mentorado Padrão\', especialidade: \'A Definir\', data_inicio_mentoria: new Date().toISOString().split(\'T\')[0] })
                });
                if (createResponse.ok) {
                    const newData = await createResponse.json();
                    currentMentoradoId = newData.id;
                    // alert(\'Novo mentorado padrão criado com ID: \' + currentMentoradoId);
                } else {
                    const errorText = await createResponse.text();
                    throw new Error(\'Falha ao criar mentorado: \' + errorText);
                }
            } else {
                const errorText = await response.text();
                throw new Error(\'Falha ao verificar mentorado: \' + errorText);
            }
            await loadMentoradoData(currentMentoradoId);
        } catch (error) {
            console.error(\'Erro na inicialização:\', error);
            alert(\'Erro ao inicializar a página: \' + error.message);
        }
    }

    async function loadMentoradoData(mentoradoId) {
        try {
            const response = await fetch(`${API_URL}/mentorado/${mentoradoId}`);
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(\'Falha ao carregar dados do mentorado: \' + errorText);
            }
            const data = await response.json();

            document.getElementById(\'mentorado-nome\').value = data.nome || \'\';
            document.getElementById(\'mentorado-especialidade\').value = data.especialidade || \'\';
            document.getElementById(\'mentorado-data-inicio\').value = data.data_inicio_mentoria || \'\';
            document.getElementById(\'meta-proximo-mes\').value = data.meta_proximo_mes || \'\';
            document.getElementById(\'pontos-melhorar\').value = data.pontos_melhorar || \'\';
            document.getElementById(\'estrategias-mentor\').value = data.estrategias_sugeridas_mentor || \'\';
            document.getElementById(\'anotacoes-adicionais\').value = data.anotacoes_adicionais || \'\';

            allHabilidades = data.lista_habilidades || [];
            populateHabilidadesTable(data.lista_habilidades || [], data.sessoes || [], data.avaliacoes_habilidade || []);
            
            allSessaoDataMap.clear();
            (data.sessoes || []).forEach(sessao => {
                allSessaoDataMap.set(sessao.id.toString(), sessao); // Armazena dados da sessão pelo ID do BD
                const sessionHtmlId = getSessionHtmlIdByName(sessao.nome_sessao); // ex: inicial-content
                const container = document.getElementById(sessionHtmlId);
                if (container) {
                    container.dataset.sessionId = sessao.id; // Link container to DB session ID
                    // Limpa o estado de renderizado para forçar a repopulação se necessário
                    delete container.dataset.rendered; 
                } else {
                    console.warn(\'Container HTML não encontrado para a sessão do BD:\', sessao.nome_sessao, sessionHtmlId);
                }
            });

            // Garante que a sessão inicial (ou a primeira da lista de navegação) seja exibida e populada
            const initialSessionLink = document.querySelector(\'nav#session-nav a.active-link\');
            const initialSessionName = initialSessionLink ? initialSessionLink.dataset.session : \'inicial\';
            showSession(initialSessionName);

        } catch (error) {
            console.error(\'Erro ao carregar dados do mentorado:\', error);
            alert(\'Erro ao carregar dados: \' + error.message);
        }
    }
    
    function getSessionHtmlIdByName(dbSessionName) {
        const mapping = {
            "Inicial": "inicial-content",
            "Sessão 1": "sessao1-content",
            "Sessão 2": "sessao2-content",
            "Sessão 3": "sessao3-content",
            "Sessão 4": "sessao4-content",
            "Sessão 5": "sessao5-content",
            "Sessão 6": "sessao6-content"
        };
        return mapping[dbSessionName];
    }

    function populateHabilidadesTable(habilidades, sessoesDb, avaliacoes) {
        const tableHead = document.querySelector(\'#habilidades-table thead tr\');
        const tableBody = document.getElementById(\'habilidades-tbody\');
        tableHead.innerHTML = \'<th>Habilidade</th>\';
        tableBody.innerHTML = \'\';

        const sessaoNamesOrdered = ["Inicial", "Sessão 1", "Sessão 2", "Sessão 3", "Sessão 4", "Sessão 5", "Sessão 6"];
        const sessoesDbMap = new Map();
        sessoesDb.forEach(s => sessoesDbMap.set(s.nome_sessao, s.id));

        sessaoNamesOrdered.forEach(nome => {
            const th = document.createElement(\'th\');
            th.textContent = nome;
            tableHead.appendChild(th);
        });

        (habilidades || []).sort((a, b) => a.ordem - b.ordem).forEach(habilidade => {
            const tr = document.createElement(\'tr\');
            const tdHabilidade = document.createElement(\'td\');
            tdHabilidade.textContent = habilidade.nome_habilidade;
            tr.appendChild(tdHabilidade);

            sessaoNamesOrdered.forEach(nomeSessao => {
                const sessaoId = sessoesDbMap.get(nomeSessao);
                const tdInput = document.createElement(\'td\');
                const input = document.createElement(\'input\');
                input.type = \'number\';
                input.min = \'1\';
                input.max = \'5\';
                input.dataset.habilidadeId = habilidade.id;
                if (sessaoId) input.dataset.sessaoId = sessaoId;
                
                const avaliacao = (avaliacoes || []).find(a => a.habilidade_id === habilidade.id && a.sessao_id === sessaoId);
                if (avaliacao) {
                    input.value = avaliacao.nivel_confianca;
                }
                input.addEventListener(\'change\', saveAvaliacaoHabilidade);
                tdInput.appendChild(input);
                tr.appendChild(tdInput);
            });
            tableBody.appendChild(tr);
        });
    }

    function populateSessionForm(container, sessaoData) {
        const form = container.querySelector(\'form.session-form\');
        if (!form || !sessaoData) {
            console.warn(\'Formulário ou dados da sessão não encontrados para popular:\', container, sessaoData);
            return;
        }
        form.querySelector(\'input[name="session_id"]\').value = sessaoData.id;
        form.querySelector(\'input[name="data_sessao"]\').value = sessaoData.data_sessao || \'\';
        form.querySelector(\'textarea[name="resultados_observados_imediatos"]\').value = sessaoData.resultados_observados_imediatos || \'\';
        form.querySelector(\'textarea[name="resultados_observados_apos_7_dias"]\').value = sessaoData.resultados_observados_apos_7_dias || \'\';
        form.querySelector(\'textarea[name="complicacoes_descricao"]\').value = sessaoData.complicacoes_descricao || \'\';
        form.querySelector(\'textarea[name="complicacoes_manejo_realizado"]\').value = sessaoData.complicacoes_manejo_realizado || \'\';
        form.querySelector(\'textarea[name="complicacoes_resultado_manejo"]\').value = sessaoData.complicacoes_resultado_manejo || \'\';
        form.querySelector(\'textarea[name="feedback_mentor"]\').value = sessaoData.feedback_mentor || \'\';

        const tbodyId = container.id.replace(\'content\', \'casos-clinicos-tbody\');
        renderCasosClinicos(tbodyId, sessaoData.casos_clinicos || [], sessaoData.id);
        
        const duvidasContainerId = container.id.replace(\'content\', \'duvidas-container\');
        renderDuvidas(duvidasContainerId, sessaoData.duvidas_discussao || [], sessaoData.id);
        container.dataset.rendered = \'true\'; // Marcar como renderizado
    }

    document.getElementById(\'save-mentorado-details\').addEventListener(\'click\', async () => {
        const payload = {
            nome: document.getElementById(\'mentorado-nome\').value,
            especialidade: document.getElementById(\'mentorado-especialidade\').value,
            data_inicio_mentoria: document.getElementById(\'mentorado-data-inicio\').value,
            meta_proximo_mes: document.getElementById(\'meta-proximo-mes\').value,
            pontos_melhorar: document.getElementById(\'pontos-melhorar\').value,
            estrategias_sugeridas_mentor: document.getElementById(\'estrategias-mentor\').value,
            anotacoes_adicionais: document.getElementById(\'anotacoes-adicionais\').value
        };
        try {
            const response = await fetch(`${API_URL}/mentorado/${currentMentoradoId}/general`, {
                method: \'PUT\',
                headers: { \'Content-Type\': \'application/json\', \'Accept\': \'application/json\' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(\'Falha ao salvar dados gerais do mentorado: \' + errorText);
            }
            alert(\'Dados gerais do mentorado salvos com sucesso!\');
        } catch (error) {
            console.error(\'Erro ao salvar dados gerais do mentorado:\', error);
            alert(\'Erro ao salvar: \' + error.message);
        }
    });

    document.getElementById(\'save-general-fields\').addEventListener(\'click\', () => {
        document.getElementById(\'save-mentorado-details\').click();
    });

    async function saveAvaliacaoHabilidade(event) {
        const input = event.target;
        const payload = {
            mentorado_id: currentMentoradoId,
            sessao_id: parseInt(input.dataset.sessaoId),
            habilidade_id: parseInt(input.dataset.habilidadeId),
            nivel_confianca: parseInt(input.value)
        };
        if (!payload.sessao_id || !payload.habilidade_id) {
            console.warn(\'ID da sessão ou habilidade ausente para salvar avaliação.\', payload);
            return;
        }
        try {
            const response = await fetch(`${API_URL}/avaliacao_habilidade`, {
                method: \'POST\',
                headers: { \'Content-Type\': \'application/json\', \'Accept\': \'application/json\' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || \'Falha ao salvar avaliação de habilidade\');
            }
        } catch (error) {
            console.error(\'Erro ao salvar avaliação:\', error);
            alert(\'Erro ao salvar avaliação: \' + error.message);
        }
    }
    
    document.querySelectorAll(\'main#session-content .save-session-data\').forEach(button => {
        button.addEventListener(\'click\', async function() {
            const form = this.closest(\'form.session-form\');
            const sessionId = form.querySelector(\'input[name="session_id"]\').value;
            if (!sessionId) {
                alert(\'ID da sessão não encontrado! Não é possível salvar.\');
                return;
            }
            const payload = {
                data_sessao: form.querySelector(\'input[name="data_sessao"]\').value,
                resultados_observados_imediatos: form.querySelector(\'textarea[name="resultados_observados_imediatos"]\').value,
                resultados_observados_apos_7_dias: form.querySelector(\'textarea[name="resultados_observados_apos_7_dias"]\').value,
                complicacoes_descricao: form.querySelector(\'textarea[name="complicacoes_descricao"]\').value,
                complicacoes_manejo_realizado: form.querySelector(\'textarea[name="complicacoes_manejo_realizado"]\').value,
                complicacoes_resultado_manejo: form.querySelector(\'textarea[name="complicacoes_resultado_manejo"]\').value,
                feedback_mentor: form.querySelector(\'textarea[name="feedback_mentor"]\').value,
            };

            try {
                const response = await fetch(`${API_URL}/sessao/${sessionId}`, {
                    method: \'PUT\',
                    headers: { \'Content-Type\': \'application/json\', \'Accept\': \'application/json\' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(\'Falha ao salvar dados da sessão: \' + errorText);
                }
                alert(\'Dados da sessão salvos com sucesso!\');
                if(allSessaoDataMap.has(sessionId)) {
                    Object.assign(allSessaoDataMap.get(sessionId), payload);
                }
            } catch (error) {
                console.error(\'Erro ao salvar dados da sessão:\', error);
                alert(\'Erro ao salvar sessão: \' + error.message);
            }
        });
    });

    function renderCasosClinicos(tbodyId, casos, sessaoDbId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = \'\';
        (casos || []).forEach(caso => {
            const tr = document.createElement(\'tr\');
            tr.dataset.casoId = caso.id;
            tr.innerHTML = `
                <td><input type="text" name="nome_paciente" value="${caso.nome_paciente || \'\'.toString().replace(/"/g, \'&quot;\')}" class="caso-input"></td>
                <td><input type="text" name="idade_paciente" value="${caso.idade_paciente || \'\'.toString().replace(/"/g, \'&quot;\')}" class="caso-input"></td>
                <td><textarea name="procedimento" class="caso-input">${caso.procedimento || \'\'.toString().replace(/"/g, \'&quot;\')}</textarea></td>
                <td><textarea name="material_utilizado" class="caso-input">${caso.material_utilizado || \'\'.toString().replace(/"/g, \'&quot;\')}</textarea></td>
                <td><input type="text" name="volume_aplicado" value="${caso.volume_aplicado || \'\'.toString().replace(/"/g, \'&quot;\')}" class="caso-input"></td>
                <td><textarea name="tecnica" class="caso-input">${caso.tecnica || \'\'.toString().replace(/"/g, \'&quot;\')}</textarea></td>
                <td>
                    ${caso.foto_antes_path ? `<img src="/${caso.foto_antes_path}" alt="Antes" width="50" style="display:block; margin-bottom:5px;"><br>` : \'\'.toString().replace(/"/g, \'&quot;\')}
                    <input type="file" name="foto_antes" class="caso-input-file">
                </td>
                <td>
                    ${caso.foto_depois_path ? `<img src="/${caso.foto_depois_path}" alt="Depois" width="50" style="display:block; margin-bottom:5px;"><br>` : \'\'.toString().replace(/"/g, \'&quot;\')}
                    <input type="file" name="foto_depois" class="caso-input-file">
                </td>
                <td>
                    <button type="button" class="save-caso-clinico">Salvar Caso</button>
                    <button type="button" class="delete-caso-clinico">Excluir Caso</button>
                </td>
            `;
            tbody.appendChild(tr);
            tr.querySelector(\".save-caso-clinico\").addEventListener(\'click\', () => saveCasoClinico(tr, sessaoDbId, caso.id));
            tr.querySelector(\".delete-caso-clinico\").addEventListener(\'click\', () => deleteCasoClinico(sessaoDbId, caso.id, tr));
        });
    }

    document.querySelectorAll(\'main#session-content .add-caso-clinico\').forEach(button => {
        button.addEventListener(\'click\', async function() {
            const form = this.closest(\'form.session-form\');
            const sessaoDbId = form.querySelector(\'input[name="session_id"]\').value;
            if (!sessaoDbId) {
                alert(\'ID da sessão não definido. Salve os dados da sessão primeiro ou recarregue.\');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/sessao/${sessaoDbId}/caso_clinico`, {
                    method: \'POST\',
                    headers: { \'Content-Type\': \'application/json\', \'Accept\': \'application/json\' },
                    body: JSON.stringify({ nome_paciente: \'Novo Caso Clínico\' }) // Default data
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(\'Falha ao adicionar novo caso clínico: \' + errorText);
                }
                const novoCaso = await response.json();
                const tbodyId = this.closest(\'section.casos-clinicos-section\').querySelector(\'table tbody\').id;
                
                // Adiciona o novo caso à lista local e renderiza novamente
                const sessaoAtual = allSessaoDataMap.get(sessaoDbId);
                if (sessaoAtual) {
                    if (!sessaoAtual.casos_clinicos) sessaoAtual.casos_clinicos = [];
                    sessaoAtual.casos_clinicos.push(novoCaso);
                    renderCasosClinicos(tbodyId, sessaoAtual.casos_clinicos, sessaoDbId);
                } else {
                    // Se não encontrar a sessão, recarrega tudo para garantir consistência
                    await loadMentoradoData(currentMentoradoId);
                }
            } catch (error) {
                console.error(\'Erro ao adicionar caso clínico:\', error);
                alert(\'Erro ao adicionar caso clínico: \' + error.message);
            }
        });
    });

    async function saveCasoClinico(tableRow, sessaoDbId, casoId) {
        const formData = new FormData();
        formData.append(\'nome_paciente\', tableRow.querySelector(\'input[name="nome_paciente"]\').value);
        formData.append(\'idade_paciente\', tableRow.querySelector(\'input[name="idade_paciente"]\').value);
        formData.append(\'procedimento\', tableRow.querySelector(\'textarea[name="procedimento"]\').value);
        formData.append(\'material_utilizado\', tableRow.querySelector(\'textarea[name="material_utilizado"]\').value);
        formData.append(\'volume_aplicado\', tableRow.querySelector(\'input[name="volume_aplicado"]\').value);
        formData.append(\'tecnica\', tableRow.querySelector(\'textarea[name="tecnica"]\').value);
        
        const fotoAntesFile = tableRow.querySelector(\'input[name="foto_antes"]\
').files[0];
        if (fotoAntesFile) formData.append(\'foto_antes\', fotoAntesFile);
        
        const fotoDepoisFile = tableRow.querySelector(\'input[name="foto_depois"]\
').files[0];
        if (fotoDepoisFile) formData.append(\'foto_depois\', fotoDepoisFile);

        try {
            const response = await fetch(`${API_URL}/sessao/${sessaoDbId}/caso_clinico/${casoId}`, {
                method: \'PUT\',
                body: formData // FormData é enviado sem Content-Type header, o browser define automaticamente
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(\'Falha ao salvar caso clínico: \' + errorText);
            }
            const casoAtualizado = await response.json();
            alert(\'Caso clínico salvo com sucesso!\');
            // Atualizar a imagem na interface se um novo caminho foi retornado
            const tbodyId = tableRow.closest(\'tbody\').id;
            const sessaoAtual = allSessaoDataMap.get(sessaoDbId);
            if (sessaoAtual && sessaoAtual.casos_clinicos) {
                const index = sessaoAtual.casos_clinicos.findIndex(c => c.id === casoId);
                if (index !== -1) {
                    sessaoAtual.casos_clinicos[index] = casoAtualizado;
                }
                renderCasosClinicos(tbodyId, sessaoAtual.casos_clinicos, sessaoDbId);
            }

        } catch (error) {
            console.error(\'Erro ao salvar caso clínico:\', error);
            alert(\'Erro ao salvar caso clínico: \' + error.message);
        }
    }

    async function deleteCasoClinico(sessaoDbId, casoId, tableRow) {
        if (!confirm(\'Tem certeza que deseja excluir este caso clínico? Esta ação não pode ser desfeita.\')) return;
        try {
            const response = await fetch(`${API_URL}/sessao/${sessaoDbId}/caso_clinico/${casoId}`, {
                method: \'DELETE\'
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(\'Falha ao excluir caso clínico: \' + errorText);
            }
            alert(\'Caso clínico excluído com sucesso!\');
            tableRow.remove();
            // Remove from local store
            const sessaoAtual = allSessaoDataMap.get(sessaoDbId);
            if (sessaoAtual && sessaoAtual.casos_clinicos) {
                sessaoAtual.casos_clinicos = sessaoAtual.casos_clinicos.filter(c => c.id !== casoId);
            }
        } catch (error) {
            console.error(\'Erro ao excluir caso clínico:\', error);
            alert(\'Erro ao excluir caso clínico: \' + error.message);
        }
    }

    // --- Duvidas para Discussão ---
    function renderDuvidas(containerId, duvidas, sessaoDbId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = \'\'; // Clear existing
        (duvidas || []).forEach(duvida => {
            const div = document.createElement(\'div\');
            div.classList.add(\'duvida-item\');
            div.dataset.duvidaId = duvida.id;
            div.innerHTML = `
                <textarea name="duvida_texto">${duvida.texto || \'\'.toString().replace(/"/g, \'&quot;\')}</textarea>
                <button type="button" class="save-duvida">Salvar Dúvida</button>
                <button type="button" class="delete-duvida">Excluir Dúvida</button>
            `;
            container.appendChild(div);
            div.querySelector(\".save-duvida\").addEventListener(\'click\', () => saveDuvida(div, sessaoDbId, duvida.id));
            div.querySelector(\".delete-duvida\").addEventListener(\'click\', () => deleteDuvida(sessaoDbId, duvida.id, div));
        });
    }

    document.querySelectorAll(\'main#session-content .add-duvida\').forEach(button => {
        button.addEventListener(\'click\', async function() {
            const form = this.closest(\'form.session-form\');
            const sessaoDbId = form.querySelector(\'input[name="session_id"]\').value;
            if (!sessaoDbId) {
                alert(\'ID da sessão não definido. Salve os dados da sessão primeiro ou recarregue.\');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/sessao/${sessaoDbId}/duvida`, {
                    method: \'POST\',
                    headers: { \'Content-Type\': \'application/json\', \'Accept\': \'application/json\' },
                    body: JSON.stringify({ texto: \'Nova dúvida\' })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(\'Falha ao adicionar nova dúvida: \' + errorText);
                }
                const novaDuvida = await response.json();
                const containerId = this.closest(\'section.duvidas-discussao-section\').querySelector(\'div[id*="-duvidas-container"]\
').id;
                
                const sessaoAtual = allSessaoDataMap.get(sessaoDbId);
                if (sessaoAtual) {
                    if (!sessaoAtual.duvidas_discussao) sessaoAtual.duvidas_discussao = [];
                    sessaoAtual.duvidas_discussao.push(novaDuvida);
                    renderDuvidas(containerId, sessaoAtual.duvidas_discussao, sessaoDbId);
                } else {
                    await loadMentoradoData(currentMentoradoId);
                }
            } catch (error) {
                console.error(\'Erro ao adicionar dúvida:\', error);
                alert(\'Erro ao adicionar dúvida: \' + error.message);
            }
        });
    });

    async function saveDuvida(duvidaItemDiv, sessaoDbId, duvidaId) {
        const texto = duvidaItemDiv.querySelector(\'textarea[name="duvida_texto"]\').value;
        try {
            const response = await fetch(`${API_URL}/sessao/${sessaoDbId}/duvida/${duvidaId}`, {
                method: \'PUT\',
                headers: { \'Content-Type\': \'application/json\', \'Accept\': \'application/json\' },
                body: JSON.stringify({ texto: texto })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(\'Falha ao salvar dúvida: \' + errorText);
            }
            alert(\'Dúvida salva com sucesso!\');
            const sessaoAtual = allSessaoDataMap.get(sessaoDbId);
            if (sessaoAtual && sessaoAtual.duvidas_discussao) {
                const index = sessaoAtual.duvidas_discussao.findIndex(d => d.id === duvidaId);
                if (index !== -1) {
                    sessaoAtual.duvidas_discussao[index].texto = texto;
                }
            }
        } catch (error) {
            console.error(\'Erro ao salvar dúvida:\', error);
            alert(\'Erro ao salvar dúvida: \' + error.message);
        }
    }

    async function deleteDuvida(sessaoDbId, duvidaId, duvidaItemDiv) {
        if (!confirm(\'Tem certeza que deseja excluir esta dúvida? Esta ação não pode ser desfeita.\')) return;
        try {
            const response = await fetch(`${API_URL}/sessao/${sessaoDbId}/duvida/${duvidaId}`, {
                method: \'DELETE\'
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(\'Falha ao excluir dúvida: \' + errorText);
            }
            alert(\'Dúvida excluída com sucesso!\');
            duvidaItemDiv.remove();
            const sessaoAtual = allSessaoDataMap.get(sessaoDbId);
            if (sessaoAtual && sessaoAtual.duvidas_discussao) {
                sessaoAtual.duvidas_discussao = sessaoAtual.duvidas_discussao.filter(d => d.id !== duvidaId);
            }
        } catch (error) {
            console.error(\'Erro ao excluir dúvida:\', error);
            alert(\'Erro ao excluir dúvida: \' + error.message);
        }
    }

    // Initial Load
    initializePage();
});

