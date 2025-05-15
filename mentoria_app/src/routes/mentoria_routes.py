from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
import os
from datetime import datetime

mentoria_bp = Blueprint("mentoria_bp", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Helper to get Supabase client ---
def get_supabase():
    supabase_client = current_app.config.get("SUPABASE_CLIENT")
    if not supabase_client:
        raise Exception("Supabase client not initialized")
    return supabase_client

# --- Mentorado Routes ---
@mentoria_bp.route("/mentorado/<int:mentorado_id>", methods=["GET"])
def get_mentorado_data(mentorado_id):
    supabase = get_supabase()
    try:
        # Fetch mentorado details
        mentorado_res = supabase.table("mentorados").select("*" ).eq("id", mentorado_id).maybe_single().execute()
        if not mentorado_res.data:
            return jsonify({"error": "Mentorado não encontrado"}), 404
        mentorado = mentorado_res.data

        # Fetch sessoes for this mentorado
        sessoes_res = supabase.table("sessoes").select("*, casos_clinicos(*, duvidas_discussao(*))").eq("mentorado_id", mentorado_id).order("id").execute()
        sessoes_data = sessoes_res.data if sessoes_res.data else []
        
        # Re-structure sessoes_data to match expected frontend structure if needed
        # The Supabase Python client might return nested data differently than SQLAlchemy relationships
        # For simplicity, we assume direct mapping for now or that frontend adapts.
        # If specific restructuring is needed, it would go here.
        # Example: Manually fetching and nesting duvidas if not done by select query
        for sessao_item in sessoes_data:
            if "casos_clinicos" not in sessao_item or sessao_item["casos_clinicos"] is None:
                sessao_item["casos_clinicos"] = [] # ensure it's an empty list
            for caso_item in sessao_item["casos_clinicos"]:
                 if "duvidas_discussao" not in caso_item or caso_item["duvidas_discussao"] is None:
                    caso_item["duvidas_discussao"] = []
            # Fetch duvidas for this sessao separately if not nested correctly
            duvidas_sessao_res = supabase.table("duvidas_discussao").select("*").eq("sessao_id", sessao_item["id"]).execute()
            sessao_item["duvidas_discussao"] = duvidas_sessao_res.data if duvidas_sessao_res.data else []

        # Fetch avaliacoes_habilidade for this mentorado
        avaliacoes_res = supabase.table("avaliacoes_habilidade").select("*, habilidades(nome_habilidade)").eq("mentorado_id", mentorado_id).execute()
        avaliacoes_habilidade_data = []
        if avaliacoes_res.data:
            for aval in avaliacoes_res.data:
                avaliacoes_habilidade_data.append({
                    "habilidade_id": aval["habilidade_id"],
                    "sessao_id": aval["sessao_id"],
                    "habilidade_nome": aval["habilidades"]["nome_habilidade"] if aval.get("habilidades") else "N/A",
                    "nivel_confianca": aval["nivel_confianca"]
                })

        # Fetch all habilidades (general list)
        habilidades_res = supabase.table("habilidades").select("*").order("ordem").execute()
        habilidades_data = habilidades_res.data if habilidades_res.data else []

        mentorado_full_data = {
            **mentorado,
            "sessoes": sessoes_data,
            "avaliacoes_habilidade": avaliacoes_habilidade_data,
            "lista_habilidades": habilidades_data
        }
        return jsonify(mentorado_full_data)

    except Exception as e:
        print(f"Error in get_mentorado_data: {e}")
        return jsonify({"error": str(e)}), 500

@mentoria_bp.route("/mentorado", methods=["POST"])
def create_mentorado():
    supabase = get_supabase()
    data = request.get_json()
    try:
        mentorado_payload = {
            "nome": data.get("nome"),
            "especialidade": data.get("especialidade"),
            "data_inicio_mentoria": data.get("data_inicio_mentoria")
        }
        created_mentorado_res = supabase.table("mentorados").insert(mentorado_payload).execute()
        
        if not created_mentorado_res.data:
            raise Exception("Falha ao criar mentorado no Supabase")
        novo_mentorado_id = created_mentorado_res.data[0]["id"]

        # Create default sessions
        nomes_sessoes = ["Inicial", "Sessão 1", "Sessão 2", "Sessão 3", "Sessão 4", "Sessão 5", "Sessão 6"]
        sessoes_payload = []
        for nome_sessao in nomes_sessoes:
            sessoes_payload.append({"mentorado_id": novo_mentorado_id, "nome_sessao": nome_sessao, "data_sessao": datetime.now().date().isoformat() })
        supabase.table("sessoes").insert(sessoes_payload).execute()
        
        return jsonify({"message": "Mentorado criado com sucesso", "id": novo_mentorado_id}), 201
    except Exception as e:
        print(f"Error in create_mentorado: {e}")
        return jsonify({"error": str(e)}), 400

@mentoria_bp.route("/mentorado/<int:mentorado_id>/general", methods=["PUT"])
def update_mentorado_general(mentorado_id):
    supabase = get_supabase()
    data = request.get_json()
    try:
        payload = {
            "meta_proximo_mes": data.get("meta_proximo_mes"),
            "pontos_melhorar": data.get("pontos_melhorar"),
            "estrategias_sugeridas_mentor": data.get("estrategias_sugeridas_mentor"),
            "anotacoes_adicionais": data.get("anotacoes_adicionais"),
            "nome": data.get("nome"),
            "especialidade": data.get("especialidade"),
            "data_inicio_mentoria": data.get("data_inicio_mentoria")
        }
        # Remove keys with None values so they don't overwrite existing data with null
        payload = {k: v for k, v in payload.items() if v is not None}

        supabase.table("mentorados").update(payload).eq("id", mentorado_id).execute()
        return jsonify({"message": "Informações gerais do mentorado atualizadas com sucesso"})
    except Exception as e:
        print(f"Error in update_mentorado_general: {e}")
        return jsonify({"error": str(e)}), 400

# --- Sessao Routes ---
@mentoria_bp.route("/sessao/<int:sessao_id>", methods=["PUT"])
def update_sessao(sessao_id):
    supabase = get_supabase()
    data = request.get_json()
    try:
        payload = {
            "data_sessao": data.get("data_sessao"),
            "resultados_observados_imediatos": data.get("resultados_observados_imediatos"),
            "resultados_observados_apos_7_dias": data.get("resultados_observados_apos_7_dias"),
            "complicacoes_descricao": data.get("complicacoes_descricao"),
            "complicacoes_manejo_realizado": data.get("complicacoes_manejo_realizado"),
            "complicacoes_resultado_manejo": data.get("complicacoes_resultado_manejo"),
            "feedback_mentor": data.get("feedback_mentor")
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        supabase.table("sessoes").update(payload).eq("id", sessao_id).execute()
        return jsonify({"message": "Sessão atualizada com sucesso"})
    except Exception as e:
        print(f"Error in update_sessao: {e}")
        return jsonify({"error": str(e)}), 400

# --- AvaliacaoHabilidade Routes ---
@mentoria_bp.route("/avaliacao_habilidade", methods=["POST", "PUT"])
def save_avaliacao_habilidade():
    supabase = get_supabase()
    data = request.get_json()
    mentorado_id = data.get("mentorado_id")
    sessao_id = data.get("sessao_id")
    habilidade_id = data.get("habilidade_id")
    nivel_confianca = data.get("nivel_confianca")

    if not all([mentorado_id, sessao_id, habilidade_id, nivel_confianca is not None]):
        return jsonify({"error": "Dados incompletos"}), 400

    try:
        # Upsert logic for Supabase
        response = supabase.table("avaliacoes_habilidade").upsert({
            "mentorado_id": mentorado_id,
            "sessao_id": sessao_id,
            "habilidade_id": habilidade_id,
            "nivel_confianca": nivel_confianca
        }, on_conflict="mentorado_id,sessao_id,habilidade_id").execute() # Specify conflict columns
        
        if response.data:
            return jsonify({"message": "Avaliação de habilidade salva com sucesso"}), 200
        else:
            # Log error from Supabase if available in response.error
            error_detail = response.error.message if response.error else "Unknown error from Supabase"
            raise Exception(f"Falha ao salvar avaliação no Supabase: {error_detail}")
            
    except Exception as e:
        print(f"Error in save_avaliacao_habilidade: {e}")
        return jsonify({"error": str(e)}), 400

# --- CasoClinico Routes ---
@mentoria_bp.route("/sessao/<int:sessao_id>/caso_clinico", methods=["POST"])
def add_caso_clinico(sessao_id):
    supabase = get_supabase()
    data = request.form
    foto_antes_path = None
    foto_depois_path = None
    upload_folder = current_app.config["UPLOAD_FOLDER"]

    if "foto_antes" in request.files:
        file_antes = request.files["foto_antes"]
        if file_antes and allowed_file(file_antes.filename):
            filename_antes = secure_filename(file_antes.filename)
            foto_antes_path = os.path.join("uploads", filename_antes)
            file_antes.save(os.path.join(upload_folder, filename_antes))
    
    if "foto_depois" in request.files:
        file_depois = request.files["foto_depois"]
        if file_depois and allowed_file(file_depois.filename):
            filename_depois = secure_filename(file_depois.filename)
            foto_depois_path = os.path.join("uploads", filename_depois)
            file_depois.save(os.path.join(upload_folder, filename_depois))

    try:
        payload = {
            "sessao_id": sessao_id,
            "nome_paciente": data.get("nome_paciente"),
            "idade_paciente": data.get("idade_paciente"),
            "procedimento": data.get("procedimento"),
            "material_utilizado": data.get("material_utilizado"),
            "volume_aplicado": data.get("volume_aplicado"),
            "tecnica": data.get("tecnica"),
            "foto_antes_path": foto_antes_path,
            "foto_depois_path": foto_depois_path
        }
        created_caso_res = supabase.table("casos_clinicos").insert(payload).execute()
        if not created_caso_res.data:
             raise Exception("Falha ao adicionar caso clínico no Supabase")
        novo_caso_id = created_caso_res.data[0]["id"]
        return jsonify({"message": "Caso clínico adicionado com sucesso", "id": novo_caso_id, "foto_antes_path": foto_antes_path, "foto_depois_path": foto_depois_path}), 201
    except Exception as e:
        print(f"Error in add_caso_clinico: {e}")
        return jsonify({"error": str(e)}), 400

@mentoria_bp.route("/caso_clinico/<int:caso_id>", methods=["PUT"])
def update_caso_clinico(caso_id):
    supabase = get_supabase()
    data = request.form
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    
    # Fetch existing paths first if needed, or rely on frontend to send them if unchanged
    current_caso_res = supabase.table("casos_clinicos").select("foto_antes_path, foto_depois_path").eq("id", caso_id).maybe_single().execute()
    if not current_caso_res.data:
        return jsonify({"error": "Caso clínico não encontrado"}), 404

    foto_antes_path = current_caso_res.data.get("foto_antes_path")
    foto_depois_path = current_caso_res.data.get("foto_depois_path")

    if "foto_antes" in request.files:
        file_antes = request.files["foto_antes"]
        if file_antes and allowed_file(file_antes.filename):
            filename_antes = secure_filename(file_antes.filename)
            # Optional: Delete old file from server if it exists
            if foto_antes_path and os.path.exists(os.path.join(upload_folder, os.path.basename(foto_antes_path))):
                try: os.remove(os.path.join(upload_folder, os.path.basename(foto_antes_path))) 
                except: pass 
            foto_antes_path = os.path.join("uploads", filename_antes)
            file_antes.save(os.path.join(upload_folder, filename_antes))
    
    if "foto_depois" in request.files:
        file_depois = request.files["foto_depois"]
        if file_depois and allowed_file(file_depois.filename):
            filename_depois = secure_filename(file_depois.filename)
            if foto_depois_path and os.path.exists(os.path.join(upload_folder, os.path.basename(foto_depois_path))):
                try: os.remove(os.path.join(upload_folder, os.path.basename(foto_depois_path))) 
                except: pass
            foto_depois_path = os.path.join("uploads", filename_depois)
            file_depois.save(os.path.join(upload_folder, filename_depois))
    try:
        payload = {
            "nome_paciente": data.get("nome_paciente"),
            "idade_paciente": data.get("idade_paciente"),
            "procedimento": data.get("procedimento"),
            "material_utilizado": data.get("material_utilizado"),
            "volume_aplicado": data.get("volume_aplicado"),
            "tecnica": data.get("tecnica"),
            "foto_antes_path": foto_antes_path,
            "foto_depois_path": foto_depois_path
        }
        payload = {k: v for k, v in payload.items() if v is not None or k in ["foto_antes_path", "foto_depois_path"] } # Allow null paths to be set

        supabase.table("casos_clinicos").update(payload).eq("id", caso_id).execute()
        return jsonify({"message": "Caso clínico atualizado com sucesso", "foto_antes_path": foto_antes_path, "foto_depois_path": foto_depois_path})
    except Exception as e:
        print(f"Error in update_caso_clinico: {e}")
        return jsonify({"error": str(e)}), 400

@mentoria_bp.route("/caso_clinico/<int:caso_id>", methods=["DELETE"])
def delete_caso_clinico(caso_id):
    supabase = get_supabase()
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    try:
        # Fetch paths to delete files
        caso_res = supabase.table("casos_clinicos").select("foto_antes_path, foto_depois_path").eq("id", caso_id).maybe_single().execute()
        if caso_res.data:
            if caso_res.data.get("foto_antes_path") and os.path.exists(os.path.join(upload_folder, os.path.basename(caso_res.data["foto_antes_path"]))):
                try: os.remove(os.path.join(upload_folder, os.path.basename(caso_res.data["foto_antes_path"]))) 
                except: pass
            if caso_res.data.get("foto_depois_path") and os.path.exists(os.path.join(upload_folder, os.path.basename(caso_res.data["foto_depois_path"]))):
                try: os.remove(os.path.join(upload_folder, os.path.basename(caso_res.data["foto_depois_path"]))) 
                except: pass
        
        supabase.table("casos_clinicos").delete().eq("id", caso_id).execute()
        return jsonify({"message": "Caso clínico excluído com sucesso"})
    except Exception as e:
        print(f"Error in delete_caso_clinico: {e}")
        return jsonify({"error": str(e)}), 400

# --- DuvidaDiscussao Routes ---
@mentoria_bp.route("/sessao/<int:sessao_id>/duvida", methods=["POST"])
def add_duvida(sessao_id):
    supabase = get_supabase()
    data = request.get_json()
    texto_duvida = data.get("texto_duvida")
    if not texto_duvida:
        return jsonify({"error": "Texto da dúvida é obrigatório"}), 400
    try:
        payload = {"sessao_id": sessao_id, "texto_duvida": texto_duvida}
        created_duvida_res = supabase.table("duvidas_discussao").insert(payload).execute()
        if not created_duvida_res.data:
            raise Exception("Falha ao adicionar dúvida no Supabase")
        nova_duvida_id = created_duvida_res.data[0]["id"]
        return jsonify({"message": "Dúvida adicionada com sucesso", "id": nova_duvida_id}), 201
    except Exception as e:
        print(f"Error in add_duvida: {e}")
        return jsonify({"error": str(e)}), 400

@mentoria_bp.route("/duvida/<int:duvida_id>", methods=["PUT"])
def update_duvida(duvida_id):
    supabase = get_supabase()
    data = request.get_json()
    texto_duvida = data.get("texto_duvida")
    if not texto_duvida:
        return jsonify({"error": "Texto da dúvida é obrigatório"}), 400
    try:
        supabase.table("duvidas_discussao").update({"texto_duvida": texto_duvida}).eq("id", duvida_id).execute()
        return jsonify({"message": "Dúvida atualizada com sucesso"})
    except Exception as e:
        print(f"Error in update_duvida: {e}")
        return jsonify({"error": str(e)}), 400

@mentoria_bp.route("/duvida/<int:duvida_id>", methods=["DELETE"])
def delete_duvida(duvida_id):
    supabase = get_supabase()
    try:
        supabase.table("duvidas_discussao").delete().eq("id", duvida_id).execute()
        return jsonify({"message": "Dúvida excluída com sucesso"})
    except Exception as e:
        print(f"Error in delete_duvida: {e}")
        return jsonify({"error": str(e)}), 400

